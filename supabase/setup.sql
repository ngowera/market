-- CMRP: paste this entire file into Supabase SQL Editor and Run as postgres.
-- Installs tables, functions, RLS, public catalogue, storage and realtime.
-- Does not create sample listings, change passwords or delete existing data.
-- Rerunning this installer is safe. Existing conflicting objects stop installation.
begin;
do $cmrp_installer$
declare conflict_name text;
begin
  perform pg_advisory_xact_lock(20261005,182742);
  if to_regclass('public.cmrp_installation') is not null then
    if exists(select 1 from public.cmrp_installation where version='20261009300000_release_buyer_handover_reporting.sql') then
      raise notice 'CMRP already installed; no changes made'; return;
    end if;
    raise exception 'Different CMRP version installed. Use migrations instead.';
  end if;
  select name into conflict_name from unnest(array['profiles','staff_profiles','loans_bridge','collateral_assets','asset_media','sale_authorizations','listings','auctions','bids','proxy_bids','offers','orders','payments','webhook_events','settlements','settlement_lines','release_orders','approval_requests','audit_events','watchlist','notifications','fee_rules','system_settings','integration_outbox','disputes','public_catalog']) name
    where to_regclass('public.'||name) is not null limit 1;
  if conflict_name is not null then raise exception 'Existing public.% conflicts with CMRP. No changes made; use a separate Supabase project or review the schema.',conflict_name; end if;
  select name into conflict_name from unnest(array['sale_method','listing_status','asset_status','payment_status','offer_status','approval_status']) name
    where to_regtype('public.'||name) is not null limit 1;
  if conflict_name is not null then raise exception 'Existing type public.% conflicts with CMRP. No changes made.',conflict_name; end if;
  if exists(select 1 from pg_namespace where nspname='private') then
    raise exception 'Existing private schema requires manual review. No changes made.';
  end if;
  execute $cmrp_schema$
 create extension if not exists pgcrypto;

 create type public.sale_method as enum ('fixed_price','auction','fixed_plus_offer','auction_plus_buy_now');
 create type public.listing_status as enum
 ('draft','pending_approval','scheduled','live','reserved','sold','ended','cancelled','archived');
 create type public.asset_status as enum
 ('held','sale_review','approved_for_sale','listed','sold','released','closed');
 create type public.payment_status as enum ('created','pending','verifying','paid','failed','refunded','disputed');
 create type public.offer_status as enum ('open','countered','accepted','rejected','expired','withdrawn','converted');
 create type public.approval_status as enum ('pending','approved','rejected','cancelled');

 create table public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    phone text,
    email text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
 );

 create table public.staff_profiles (
    user_id uuid primary key references auth.users(id) on delete restrict,
    full_name text not null,
    employee_ref text unique,
    security_level smallint not null check (security_level between 1 and 4),
    department text,
    is_active boolean not null default true,
    mfa_required boolean not null default false,
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id)
 );

 create table public.loans_bridge (
    id uuid primary key default gen_random_uuid(),
    source_system text not null,
    external_loan_id text not null,
    external_collateral_id text,
    borrower_reference text,
    currency text not null default 'MWK',
    outstanding_amount numeric(18,2) not null check (outstanding_amount >= 0),
    recovery_status text,
    sale_authorized_at timestamptz,
    last_synced_at timestamptz not null default now(),
    source_version text,
    unique (source_system, external_loan_id)
 );

 create table public.collateral_assets (
    id uuid primary key default gen_random_uuid(),
    loan_bridge_id uuid references public.loans_bridge(id) on delete restrict,
    asset_ref text not null unique,
    category text not null,
    title text not null,
    description text,
    make text,
    model text,
    serial_or_vin text,
    condition_grade text,
    condition_notes text,
    valuation_amount numeric(18,2) check (valuation_amount >= 0),
    currency text not null default 'MWK',
    custody_location text,
    status public.asset_status not null default 'held',
    created_at timestamptz not null default now(),
    created_by uuid not null references auth.users(id),
    updated_at timestamptz not null default now()
 );

 create table public.asset_media (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.collateral_assets(id) on delete cascade,
    storage_path text not null,
    media_type text not null check (media_type in ('public_image','private_evidence','document')),
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id)
 );

 create table public.sale_authorizations (
   id uuid primary key default gen_random_uuid(),
   asset_id uuid not null references public.collateral_assets(id) on delete restrict,
   status public.approval_status not null default 'pending',
   basis text not null,
   reference_no text,
   evidence_path text,
   requested_by uuid not null references auth.users(id),
   requested_at timestamptz not null default now(),
   decided_by uuid references auth.users(id),


   decided_at timestamptz,
   decision_reason text
 );




 create table public.listings (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.collateral_assets(id) on delete restrict,
    sale_authorization_id uuid not null references public.sale_authorizations(id) on delete restrict,
    slug text not null unique,
    method public.sale_method not null,
    status public.listing_status not null default 'draft',
    public_title text not null,
    public_description text,
    fixed_price numeric(18,2),
    offer_floor numeric(18,2),
    currency text not null default 'MWK',
    publish_at timestamptz,
    collection_point text,
    terms_version text not null,
    created_by uuid not null references auth.users(id),
    approved_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
 );

 create table public.auctions (
    listing_id uuid primary key references public.listings(id) on delete cascade,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    starting_bid numeric(18,2) not null check (starting_bid >= 0),
    current_price numeric(18,2),
    current_bidder_id uuid references auth.users(id),
    min_increment numeric(18,2) not null check (min_increment > 0),
    reserve_price numeric(18,2),
    reserve_met boolean not null default false,
    extension_window_seconds integer not null default 120,
    extension_seconds integer not null default 120,
    max_extension_count integer not null default 20,
    extension_count integer not null default 0,
    winner_user_id uuid references auth.users(id),
    closed_at timestamptz,
    check (ends_at > starts_at)
 );

 create table public.bids (
    id uuid primary key default gen_random_uuid(),
    auction_listing_id uuid not null references public.auctions(listing_id) on delete restrict,
    bidder_id uuid not null references auth.users(id) on delete restrict,
    amount numeric(18,2) not null check (amount > 0),
    sequence_no bigint generated always as identity,
    status text not null default 'accepted' check (status in ('accepted','invalidated')),
    placed_at timestamptz not null default now(),
    invalidated_reason text,
    invalidated_by uuid references auth.users(id)
 );
 create index bids_auction_time_idx on public.bids(auction_listing_id, placed_at desc);

 create table public.proxy_bids (
    auction_listing_id uuid not null references public.auctions(listing_id) on delete cascade,
    bidder_id uuid not null references auth.users(id) on delete cascade,
    max_amount numeric(18,2) not null check (max_amount > 0),
    updated_at timestamptz not null default now(),
    primary key (auction_listing_id, bidder_id)
 );

 create table public.offers (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings(id) on delete restrict,
    buyer_id uuid not null references auth.users(id) on delete restrict,
    parent_offer_id uuid references public.offers(id),
    proposed_by text not null check (proposed_by in ('buyer','seller')),
    amount numeric(18,2) not null check (amount > 0),
    status public.offer_status not null default 'open',
    expires_at timestamptz not null,
    note text,
    created_at timestamptz not null default now(),
    decided_by uuid references auth.users(id),
    decided_at timestamptz
 );




 create table public.orders (
   id uuid primary key default gen_random_uuid(),
   order_no text not null unique,
   listing_id uuid not null references public.listings(id) on delete restrict,
   buyer_id uuid not null references auth.users(id) on delete restrict,
   source text not null check (source in ('fixed_price','auction_win','accepted_offer')),


    source_ref uuid,
    currency text not null default 'MWK',
    amount_due numeric(18,2) not null check (amount_due >= 0),
    status text not null default 'awaiting_payment' check (status in
 ('awaiting_payment','paid','cancelled','refunded','released','closed','disputed')),
    payment_deadline timestamptz,
    created_at timestamptz not null default now(),
    paid_at timestamptz
 );

 create table public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete restrict,
    provider text not null default 'paychangu',
    tx_ref text not null unique,
    provider_transaction_id text,
    currency text not null,
    amount numeric(18,2) not null,
    status public.payment_status not null default 'created',
    verification_payload jsonb,
    created_at timestamptz not null default now(),
    verified_at timestamptz
 );

 create table public.webhook_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    provider_event_id text,
    event_type text,
    payload jsonb not null,
    signature_valid boolean,
    processed boolean not null default false,
    processing_error text,
    received_at timestamptz not null default now(),
    processed_at timestamptz,
    unique(provider, provider_event_id)
 );

 create table public.settlements (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null unique references public.orders(id) on delete restrict,
    status text not null default 'draft' check (status in
 ('draft','pending_approval','approved','posted_to_loan','closed','reopened')),
    gross_sale numeric(18,2) not null,
    currency text not null default 'MWK',
    rule_version text not null,
    created_at timestamptz not null default now(),
    created_by uuid not null references auth.users(id),
    approved_by uuid references auth.users(id),
    approved_at timestamptz
 );

 create table public.settlement_lines (
    id uuid primary key default gen_random_uuid(),
    settlement_id uuid not null references public.settlements(id) on delete cascade,
    line_type text not null,
    direction smallint not null check (direction in (-1,1)),
    amount numeric(18,2) not null check (amount >= 0),
    recipient_ref text,
    description text,
    created_at timestamptz not null default now()
 );

 create table public.release_orders (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null unique references public.orders(id) on delete restrict,
    release_token_hash text not null,
    status text not null default 'prepared' check (status in ('prepared','approved','released','cancelled')),
    collector_name text,
    collector_ref text,
    approved_by uuid references auth.users(id),
    approved_at timestamptz,
    released_by uuid references auth.users(id),
    released_at timestamptz,
    handover_notes text
 );




 create table public.approval_requests (
   id uuid primary key default gen_random_uuid(),
   action_type text not null,
   entity_type text not null,
   entity_id uuid not null,
   requested_by uuid not null references auth.users(id),
   required_min_level smallint not null check (required_min_level between 1 and 4),
   status public.approval_status not null default 'pending',
   reason text not null,
   proposed_values jsonb,
   requested_at timestamptz not null default now(),
   decided_by uuid references auth.users(id),
   decided_at timestamptz,
   decision_reason text,
   check (decided_by is null or decided_by <> requested_by)

);

create table public.audit_events (
   id bigint generated always as identity primary key,
   occurred_at timestamptz not null default now(),
   actor_user_id uuid,
   actor_level smallint,
   action text not null,
   entity_type text not null,
   entity_id text,
   old_values jsonb,
   new_values jsonb,
   reason text,
   approval_request_id uuid references public.approval_requests(id),
   source text not null default 'web',
   request_id text,
   correlation_id text,
   ip_address inet,
   user_agent text
);
revoke update, delete on public.audit_events from anon, authenticated;







-- CMRP secured domain implementation. Supabase Auth owns passwords and sessions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;
alter table public.listings add column image text;
alter table public.listings add column condition_grade text not null default 'Good';
alter table public.listings add column defects text;
alter table public.listings add column specs jsonb not null default '{}';
alter table public.listings add constraint listing_money_positive check (fixed_price is null or fixed_price > 0);
alter table public.auctions add constraint sane_auction_config check(extension_seconds > 0 and extension_window_seconds > 0 and max_extension_count between 0 and 100);
alter table public.sale_authorizations add constraint authorization_checker check(decided_by is null or decided_by <> requested_by);
alter table public.release_orders add column expires_at timestamptz not null default now()+interval '7 days';
alter table public.release_orders add column prepared_by uuid references auth.users(id);
alter table public.settlements add column loan_sync text not null default 'pending';
create unique index one_active_listing_per_asset on public.listings(asset_id) where status in ('scheduled','live','reserved');
create unique index one_committed_order_per_listing on public.orders(listing_id) where status in ('awaiting_payment','paid','released','closed','disputed');
create index auction_close_idx on public.auctions(ends_at) where closed_at is null;
create index order_buyer_idx on public.orders(buyer_id,created_at desc);
create index offer_buyer_idx on public.offers(buyer_id,created_at desc);
create index payment_status_idx on public.payments(status,created_at);
create index audit_action_time_idx on public.audit_events(action,occurred_at desc);
create index collateral_loan_idx on public.collateral_assets(loan_bridge_id);

create table public.watchlist(user_id uuid references auth.users(id),listing_id uuid references public.listings(id),created_at timestamptz not null default now(),primary key(user_id,listing_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),kind text not null,message text not null,entity_id uuid,created_at timestamptz not null default now(),read_at timestamptz);
create table public.fee_rules(version text primary key,platform_bps integer not null default 0 check(platform_bps between 0 and 10000),fixed_fee numeric(18,2) not null default 0 check(fixed_fee>=0),effective_at timestamptz not null,approved_by uuid references auth.users(id),is_active boolean not null default false);
insert into public.fee_rules(version,effective_at,is_active) values('no-fees-v1','2026-01-01',true);
create table public.system_settings(version uuid primary key default gen_random_uuid(),settings jsonb not null,created_at timestamptz not null default now(),approved_by uuid references auth.users(id));
insert into public.system_settings(settings) values('{"high_value_threshold":5000000,"extension_window":120,"extension_seconds":120,"max_extensions":20}');
create table public.integration_outbox(id uuid primary key default gen_random_uuid(),settlement_id uuid not null unique references public.settlements(id),idempotency_key uuid not null default gen_random_uuid() unique,payload jsonb not null,status text not null default 'pending',attempts integer not null default 0,next_attempt_at timestamptz not null default now(),last_error text,created_at timestamptz not null default now());
create table public.disputes(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),buyer_id uuid references auth.users(id),reason text not null,status text not null default 'open',created_at timestamptz not null default now());
create table public.public_catalog(id uuid primary key references public.listings(id),slug text not null unique,title text not null,category text not null,method text not null,price numeric(18,2),location text,condition text,image text,ends_at timestamptz,bids integer not null default 0,increment numeric(18,2) not null default 0,description text,defects text,specs jsonb not null default '{}',status text not null,created_at timestamptz not null default now());
create table private.rate_limits(actor text not null,bucket text not null,bucket_window timestamptz not null,count integer not null,primary key(actor,bucket,bucket_window));

create function private.staff_level() returns smallint language sql stable security definer set search_path='' as $$ select coalesce((select security_level from public.staff_profiles where user_id=auth.uid() and is_active and (security_level<3 or (auth.jwt()->>'aal')='aal2')),0)::smallint $$;
create function private.require_staff(p_level integer) returns uuid language plpgsql security definer set search_path='' as $$ begin if auth.uid() is null or private.staff_level()<p_level then raise exception 'Staff permission or MFA required';end if;return auth.uid();end $$;
create function private.require_buyer() returns uuid language plpgsql security definer set search_path='' as $$ begin if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and (email_confirmed_at is not null or phone_confirmed_at is not null) and coalesce(is_anonymous,false)=false) then raise exception 'Verified buyer account required';end if;return auth.uid();end $$;
create function private.consume_rate(p_actor text,p_bucket text,p_limit integer) returns void language plpgsql security definer set search_path='' as $$ declare n integer;begin insert into private.rate_limits values(p_actor,p_bucket,date_trunc('minute',clock_timestamp()),1) on conflict(actor,bucket,bucket_window) do update set count=private.rate_limits.count+1 returning count into n;if n>p_limit then raise exception 'Rate limit exceeded';end if;end $$;
create function private.log_event(p_action text,p_entity text,p_id text,p_old jsonb default null,p_new jsonb default null,p_reason text default null) returns void language plpgsql security definer set search_path='' as $$ begin insert into public.audit_events(actor_user_id,actor_level,action,entity_type,entity_id,old_values,new_values,reason,source) values(auth.uid(),private.staff_level(),p_action,p_entity,p_id,p_old,p_new,p_reason,case when auth.uid() is null then 'system_job' else 'web' end);end $$;
create function private.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Append-only records cannot be updated or deleted';end $$;
create trigger immutable_audit before update or delete on public.audit_events for each row execute function private.immutable();
create trigger immutable_bids before update or delete on public.bids for each row execute function private.immutable();
create function private.catalog_sync() returns trigger language plpgsql security definer set search_path='' as $$ declare lid uuid; l public.listings; a public.collateral_assets; u public.auctions;begin
 if tg_table_name='listings' then lid=new.id;else lid=new.listing_id;end if;
 select * into l from public.listings where id=lid;select * into a from public.collateral_assets where id=l.asset_id;select * into u from public.auctions where listing_id=lid;
 if l.status not in ('live','reserved','sold') then delete from public.public_catalog where id=lid;return new;end if;
 if not exists(select 1 from public.sale_authorizations where id=l.sale_authorization_id and asset_id=l.asset_id and status='approved') then raise exception 'Approved sale authorization required';end if;
 insert into public.public_catalog(id,slug,title,category,method,price,location,condition,image,ends_at,bids,increment,description,defects,specs,status,created_at) values(l.id,l.slug,l.public_title,a.category,l.method::text,coalesce(u.current_price,u.starting_bid,l.fixed_price),l.collection_point,l.condition_grade,l.image,u.ends_at,(select count(*) from public.bids where auction_listing_id=lid),coalesce(u.min_increment,0),l.public_description,l.defects,l.specs,l.status::text,l.created_at)
 on conflict(id) do update set title=excluded.title,method=excluded.method,price=excluded.price,status=excluded.status,ends_at=excluded.ends_at,bids=excluded.bids,increment=excluded.increment,image=excluded.image,description=excluded.description,defects=excluded.defects;
 return new;end $$;
create trigger catalog_listing after insert or update on public.listings for each row execute function private.catalog_sync();
create trigger catalog_auction after insert or update on public.auctions for each row execute function private.catalog_sync();

-- All mutation paths are explicit RPCs. No buyer or staff may write financial state directly.
do $$ declare t text;begin foreach t in array array['profiles','staff_profiles','loans_bridge','collateral_assets','asset_media','sale_authorizations','listings','auctions','bids','proxy_bids','offers','orders','payments','webhook_events','settlements','settlement_lines','release_orders','approval_requests','audit_events','watchlist','notifications','fee_rules','system_settings','integration_outbox','disputes','public_catalog'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant select on public.public_catalog to anon,authenticated;
create policy public_catalog_read on public.public_catalog for select to anon,authenticated using(status in ('live','reserved','sold'));
grant select,insert,update on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy profile_insert on public.profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,delete on public.watchlist to authenticated;
create policy watch_read on public.watchlist for select to authenticated using(user_id=(select auth.uid()));
create policy watch_insert on public.watchlist for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.public_catalog where id=listing_id));
create policy watch_delete on public.watchlist for delete to authenticated using(user_id=(select auth.uid()));
grant select on public.staff_profiles to authenticated;
create policy staff_read on public.staff_profiles for select to authenticated using(user_id=(select auth.uid()) or private.staff_level()>=4);
do $$ declare t text;begin foreach t in array array['listings','auctions','approval_requests','audit_events','fee_rules','system_settings','settlements','settlement_lines','integration_outbox'] loop execute format('grant select on public.%I to authenticated',t);execute format('create policy staff_read on public.%I for select to authenticated using(private.staff_level()>=1)',t);end loop;foreach t in array array['collateral_assets','loans_bridge','asset_media','sale_authorizations','webhook_events'] loop execute format('grant select on public.%I to authenticated',t);execute format('create policy staff_read on public.%I for select to authenticated using(private.staff_level()>=2)',t);end loop;end $$;
grant select on public.bids,public.offers,public.orders,public.payments,public.release_orders,public.notifications,public.disputes to authenticated;
create policy bids_read on public.bids for select to authenticated using(bidder_id=(select auth.uid()) or private.staff_level()>=1);
create policy offers_read on public.offers for select to authenticated using(buyer_id=(select auth.uid()) or private.staff_level()>=2);
create policy orders_read on public.orders for select to authenticated using(buyer_id=(select auth.uid()) or private.staff_level()>=1);
create policy payments_read on public.payments for select to authenticated using(exists(select 1 from public.orders where id=order_id and buyer_id=(select auth.uid())) or private.staff_level()>=1);
create policy releases_read on public.release_orders for select to authenticated using(exists(select 1 from public.orders where id=order_id and buyer_id=(select auth.uid())) or private.staff_level()>=2);
create policy notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy disputes_read on public.disputes for select to authenticated using(buyer_id=(select auth.uid()) or private.staff_level()>=2);

create function private.place_bid(p_listing uuid,p_amount numeric) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;u public.auctions;l public.listings;minimum numeric;old_bidder uuid;begin
 actor=private.require_buyer();perform private.consume_rate(actor::text,'bid',15);select * into l from public.listings where id=p_listing for update;select * into u from public.auctions where listing_id=p_listing for update;
 if u.listing_id is null or l.status<>'live' or clock_timestamp()<u.starts_at or clock_timestamp()>=u.ends_at or u.closed_at is not null then raise exception 'Auction is not open';end if;
 if u.current_bidder_id=actor then raise exception 'You are already the highest bidder';end if;
 minimum=case when u.current_price is null then u.starting_bid else u.current_price+u.min_increment end;
 if p_amount is null or p_amount<minimum or p_amount<>round(p_amount,2) then raise exception 'Bid is below required amount or invalid precision';end if;
 old_bidder=u.current_bidder_id;insert into public.bids(auction_listing_id,bidder_id,amount) values(p_listing,actor,p_amount);
 update public.auctions set current_price=p_amount,current_bidder_id=actor,reserve_met=(reserve_price is null or p_amount>=reserve_price),ends_at=case when ends_at-clock_timestamp()<=make_interval(secs=>extension_window_seconds) and extension_count<max_extension_count then ends_at+make_interval(secs=>extension_seconds) else ends_at end,extension_count=extension_count+case when ends_at-clock_timestamp()<=make_interval(secs=>extension_window_seconds) and extension_count<max_extension_count then 1 else 0 end where listing_id=p_listing;
 perform private.log_event('bid.accepted','auction',p_listing::text,null,jsonb_build_object('amount',p_amount));
 if old_bidder is not null then insert into public.notifications(user_id,kind,message,entity_id) values(old_bidder,'outbid','Another buyer placed a higher bid.',p_listing);end if;
 return jsonb_build_object('status','accepted','amount',p_amount);end $$;
create function public.place_bid(p_listing uuid,p_amount numeric) returns jsonb language sql security invoker set search_path='' as $$select private.place_bid(p_listing,p_amount)$$;

create function private.reserve_order(p_listing uuid,p_source text,p_buyer uuid,p_amount numeric,p_ref uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$ declare o public.orders;begin
 insert into public.orders(order_no,listing_id,buyer_id,source,source_ref,amount_due,payment_deadline) values('ORD-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),p_listing,p_buyer,p_source,p_ref,p_amount,now()+interval '30 minutes') returning * into o;
 update public.listings set status='reserved' where id=p_listing;perform private.log_event('order.reserved','order',o.id::text,null,to_jsonb(o));return to_jsonb(o);end $$;
create function private.buy_now(p_listing uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;l public.listings;begin actor=private.require_buyer();perform private.consume_rate(actor::text,'buy',5);select * into l from public.listings where id=p_listing for update;if l.status<>'live' or l.id is null or l.fixed_price is null or l.method not in ('fixed_price','fixed_plus_offer','auction_plus_buy_now') then raise exception 'Asset unavailable for fixed-price purchase';end if;if l.method='auction_plus_buy_now' and exists(select 1 from public.bids where auction_listing_id=p_listing) then raise exception 'Buy now disabled after first bid';end if;return private.reserve_order(p_listing,'fixed_price',actor,l.fixed_price);end $$;
create function public.buy_now(p_listing uuid) returns jsonb language sql security invoker set search_path='' as $$select private.buy_now(p_listing)$$;
create function private.submit_offer(p_listing uuid,p_amount numeric,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;l public.listings;o public.offers;begin actor=private.require_buyer();perform private.consume_rate(actor::text,'offer',5);select * into l from public.listings where id=p_listing for update;if l.id is null or l.status<>'live' or l.method<>'fixed_plus_offer' or p_amount<=0 or p_amount<>round(p_amount,2) or length(p_note)>500 or (l.offer_floor is not null and p_amount<l.offer_floor) then raise exception 'Offer is not eligible';end if;insert into public.offers(listing_id,buyer_id,proposed_by,amount,expires_at,note) values(p_listing,actor,'buyer',p_amount,now()+interval '48 hours',p_note) returning * into o;perform private.log_event('offer.submitted','offer',o.id::text,null,to_jsonb(o));return to_jsonb(o);end $$;
create function public.submit_offer(p_listing uuid,p_amount numeric,p_note text) returns jsonb language sql security invoker set search_path='' as $$select private.submit_offer(p_listing,p_amount,p_note)$$;
create function private.bid_history(p_listing uuid) returns table(sequence_no bigint,alias text,amount numeric,placed_at timestamptz) language sql stable security definer set search_path='' as $$select b.sequence_no,'Bidder-'||substr(md5(b.bidder_id::text||b.auction_listing_id::text),1,6),b.amount,b.placed_at from public.bids b join public.public_catalog c on c.id=b.auction_listing_id where b.auction_listing_id=p_listing order by b.sequence_no desc limit 50$$;
create function public.bid_history(p_listing uuid) returns table(sequence_no bigint,alias text,amount numeric,placed_at timestamptz) language sql security invoker set search_path='' as $$select * from private.bid_history(p_listing)$$;

create function private.create_asset(p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;loan uuid;a public.collateral_assets;begin actor=private.require_staff(2);select id into loan from public.loans_bridge where external_loan_id=p_values->>'external_loan_id';if loan is null then raise exception 'Loan not synchronized. Import via the loan bridge first.';end if;insert into public.collateral_assets(loan_bridge_id,asset_ref,title,category,valuation_amount,custody_location,condition_notes,created_by) values(loan,p_values->>'asset_ref',p_values->>'title',p_values->>'category',(p_values->>'valuation_amount')::numeric,p_values->>'custody_location',p_values->>'condition_notes',actor) returning * into a;perform private.log_event('asset.created','asset',a.id::text,null,to_jsonb(a),p_values->>'reason');return to_jsonb(a);end $$;
create function public.create_asset(p_values jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.create_asset(p_values)$$;
create function private.request_authorization(p_asset uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;a public.sale_authorizations;r public.approval_requests;begin actor=private.require_staff(2);perform 1 from public.collateral_assets where id=p_asset for update;if not found then raise exception 'Asset not found';end if;insert into public.sale_authorizations(asset_id,basis,reference_no,evidence_path,requested_by) values(p_asset,p_values->>'basis',p_values->>'reference_no',p_values->>'evidence_path',actor) returning * into a;insert into public.approval_requests(action_type,entity_type,entity_id,requested_by,required_min_level,reason,proposed_values) values('sale_authorization','sale_authorization',a.id,actor,3,p_values->>'reason',p_values) returning * into r;update public.collateral_assets set status='sale_review' where id=p_asset;perform private.log_event('authorization.requested','asset',p_asset::text,null,to_jsonb(r));return to_jsonb(r);end $$;
create function public.request_authorization(p_asset uuid,p_values jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.request_authorization(p_asset,p_values)$$;
create function private.create_listing(p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;l public.listings;a public.sale_authorizations;r public.approval_requests;cfg jsonb;begin actor=private.require_staff(2);select * into a from public.sale_authorizations where id=(p_values->>'sale_authorization_id')::uuid and asset_id=(p_values->>'asset_id')::uuid;if a.status<>'approved' or a.id is null then raise exception 'Approved sale authorization required';end if;
 insert into public.listings(asset_id,sale_authorization_id,slug,method,status,public_title,public_description,fixed_price,collection_point,terms_version,image,defects,created_by) values(a.asset_id,a.id,p_values->>'slug',(p_values->>'method')::public.sale_method,'pending_approval',p_values->>'title',p_values->>'description',case when p_values->>'method'='auction' then null else (p_values->>'price')::numeric end,p_values->>'collection_point',p_values->>'terms_version',p_values->>'image',p_values->>'defects',actor) returning * into l;
 if l.method in ('auction','auction_plus_buy_now') then select settings into cfg from public.system_settings order by created_at desc limit 1;insert into public.auctions(listing_id,starts_at,ends_at,starting_bid,min_increment,extension_window_seconds,extension_seconds,max_extension_count) values(l.id,now(),now()+make_interval(hours=>(p_values->>'duration_hours')::integer),(p_values->>'price')::numeric,(p_values->>'increment')::numeric,(cfg->>'extension_window')::integer,(cfg->>'extension_seconds')::integer,(cfg->>'max_extensions')::integer);end if;
 insert into public.approval_requests(action_type,entity_type,entity_id,requested_by,required_min_level,reason,proposed_values) values('publish_listing','listing',l.id,actor,3,p_values->>'reason',p_values) returning * into r;perform private.log_event('listing.created','listing',l.id::text,null,to_jsonb(l));return to_jsonb(l);end $$;
create function public.create_listing(p_values jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.create_listing(p_values)$$;

create function private.request_change(p_action text,p_entity uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;r public.approval_requests;required integer;begin required=case when p_action in ('staff_change','settings_change','fee_change') then 4 else 3 end;actor=private.require_staff(case when p_action in ('release','settlement') then 2 else required end);if p_action not in ('staff_change','settings_change','fee_change','settlement','release') then raise exception 'Unsupported change';end if;
 if p_action='release' and not exists(select 1 from public.orders where id=p_entity and status='paid') then raise exception 'Verified paid order required';end if;
 if p_action='settlement' and not exists(select 1 from public.settlements where id=p_entity and status='draft') then raise exception 'Draft settlement required';end if;
 insert into public.approval_requests(action_type,entity_type,entity_id,requested_by,required_min_level,reason,proposed_values) values(p_action,p_action,p_entity,actor,required,coalesce(p_values->>'reason','Operational review requested'),p_values) returning * into r;perform private.log_event('approval.requested',p_action,p_entity::text,null,to_jsonb(r));return to_jsonb(r);end $$;
create function public.request_change(p_action text,p_entity uuid,p_values jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.request_change(p_action,p_entity,p_values)$$;

create function private.approve_action(p_request uuid,p_decision text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;r public.approval_requests;v jsonb;s public.settlements;o public.orders;authorization_row public.sale_authorizations;total numeric;token text;begin actor=private.require_staff(3);select * into r from public.approval_requests where id=p_request for update;
 if r.id is null or r.status<>'pending' or r.requested_by=actor or private.staff_level()<r.required_min_level or p_decision not in ('approved','rejected') or length(trim(p_reason))<3 then raise exception 'Independent eligible approver and reason required';end if;v=r.proposed_values;
 if p_decision='approved' then
 case r.action_type
 when 'sale_authorization' then select * into authorization_row from public.sale_authorizations where id=r.entity_id for update;update public.sale_authorizations set status='approved',decided_by=actor,decided_at=now(),decision_reason=p_reason where id=r.entity_id;update public.collateral_assets set status='approved_for_sale' where id=authorization_row.asset_id;
 when 'publish_listing' then if not exists(select 1 from public.listings l join public.sale_authorizations a on a.id=l.sale_authorization_id and a.asset_id=l.asset_id where l.id=r.entity_id and l.status='pending_approval' and a.status='approved') then raise exception 'Sale authorization required';end if;update public.listings set status='live',approved_by=actor,publish_at=now() where id=r.entity_id;update public.collateral_assets set status='listed' where id=(select asset_id from public.listings where id=r.entity_id);
 when 'staff_change' then insert into public.staff_profiles(user_id,full_name,security_level,is_active,mfa_required,created_by) values((v->>'user_id')::uuid,v->>'full_name',(v->>'security_level')::smallint,(v->>'is_active')::boolean,(v->>'security_level')::integer>=3,actor) on conflict(user_id) do update set full_name=excluded.full_name,security_level=excluded.security_level,is_active=excluded.is_active,mfa_required=excluded.mfa_required;
 when 'settings_change' then insert into public.system_settings(settings,approved_by) values(v,actor);
 when 'fee_change' then insert into public.fee_rules(version,platform_bps,fixed_fee,effective_at,approved_by,is_active) values(v->>'version',(v->>'platform_bps')::integer,(v->>'fixed_fee')::numeric,(v->>'effective_at')::timestamptz,actor,true);
 when 'settlement' then select * into s from public.settlements where id=r.entity_id for update;if s.status<>'draft' or not exists(select 1 from public.orders where id=s.order_id and status in ('paid','released')) then raise exception 'Paid draft settlement required';end if;select sum(direction*amount) into total from public.settlement_lines where settlement_id=s.id and line_type<>'SHORTFALL';if total<>0 or total is null then raise exception 'Settlement does not balance';end if;update public.settlements set status='approved',approved_by=actor,approved_at=now() where id=s.id;
 insert into public.integration_outbox(settlement_id,payload) select s.id,jsonb_build_object('external_loan_id',b.external_loan_id,'marketplace_order_no',ord.order_no,'gross_sale',s.gross_sale,'currency',s.currency,'loan_recovery',(select amount from public.settlement_lines where settlement_id=s.id and line_type='RECOVERY_TO_LOAN'),'surplus',(select amount from public.settlement_lines where settlement_id=s.id and line_type='OWNER_SURPLUS'),'settled_at',now()) from public.orders ord join public.listings l on l.id=ord.listing_id join public.collateral_assets a on a.id=l.asset_id join public.loans_bridge b on b.id=a.loan_bridge_id where ord.id=s.order_id on conflict(settlement_id) do nothing;
 when 'release' then select * into o from public.orders where id=r.entity_id for update;if o.status<>'paid' then raise exception 'Verified payment required';end if;token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');insert into public.release_orders(order_id,release_token_hash,status,approved_by,approved_at,prepared_by,collector_name,collector_ref) values(o.id,encode(sha256(convert_to(token,'UTF8')),'hex'),'approved',actor,now(),r.requested_by,v->>'collector_name',v->>'collector_ref');insert into public.notifications(user_id,kind,message,entity_id) values(o.buyer_id,'collection_ready','Your collection code: '||token,o.id);
 else raise exception 'Unsupported approval action';end case;
 end if;
 update public.approval_requests set status=p_decision::public.approval_status,decided_by=actor,decided_at=now(),decision_reason=p_reason where id=r.id;
 perform private.log_event('approval.'||p_decision,r.entity_type,r.entity_id::text,to_jsonb(r),jsonb_build_object('decision',p_decision),p_reason);return jsonb_build_object('status',p_decision);end $$;
create function public.approve_action(p_request uuid,p_decision text,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select private.approve_action(p_request,p_decision,p_reason)$$;

create function private.decide_offer(p_offer uuid,p_decision text,p_amount numeric,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;o public.offers;l public.listings;counter public.offers;begin actor=private.require_staff(3);select listing_id into l.id from public.offers where id=p_offer;select * into l from public.listings where id=l.id for update;select * into o from public.offers where id=p_offer for update;if o.status not in ('open','countered') or o.expires_at<=now() or l.status<>'live' then raise exception 'Offer no longer available';end if;
 if p_decision='accepted' then if o.proposed_by<>'buyer' then raise exception 'Buyer must accept a seller counteroffer';end if;if l.offer_floor is not null and o.amount<l.offer_floor then raise exception 'Below-floor offer needs exceptional approval';end if;update public.offers set status='converted',decided_by=actor,decided_at=now() where id=o.id;perform private.reserve_order(l.id,'accepted_offer',o.buyer_id,o.amount,o.id);
 elsif p_decision='countered' then if p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'Valid counter amount required';end if;update public.offers set status='countered',decided_by=actor,decided_at=now() where id=o.id;insert into public.offers(listing_id,buyer_id,parent_offer_id,proposed_by,amount,status,expires_at,note) values(l.id,o.buyer_id,o.id,'seller',p_amount,'open',now()+interval '24 hours',p_reason) returning * into counter;
 elsif p_decision='rejected' then update public.offers set status='rejected',decided_by=actor,decided_at=now() where id=o.id;else raise exception 'Invalid decision';end if;insert into public.notifications(user_id,kind,message,entity_id) values(o.buyer_id,'offer_update','Your offer was '||p_decision,o.id);perform private.log_event('offer.'||p_decision,'offer',o.id::text,to_jsonb(o),to_jsonb(counter),p_reason);return jsonb_build_object('status',p_decision);end $$;
create function public.decide_offer(p_offer uuid,p_decision text,p_amount numeric,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select private.decide_offer(p_offer,p_decision,p_amount,p_reason)$$;

create function private.release_asset(p_order uuid,p_token text,p_collector text,p_ref text,p_notes text) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;o public.orders;r public.release_orders;begin actor=private.require_staff(2);select * into o from public.orders where id=p_order for update;select * into r from public.release_orders where order_id=p_order for update;if o.status<>'paid' or r.status<>'approved' or r.id is null or r.expires_at<now() or r.release_token_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex') or r.collector_name<>p_collector or r.collector_ref<>p_ref then raise exception 'Payment, approved release, code and collector must match';end if;if actor=r.approved_by then raise exception 'Handover requires a different staff member from the approver';end if;update public.release_orders set status='released',released_by=actor,released_at=now(),handover_notes=p_notes where id=r.id;update public.orders set status='released' where id=o.id;update public.collateral_assets set status='released' where id=(select asset_id from public.listings where id=o.listing_id);perform private.log_event('asset.released','order',o.id::text,to_jsonb(r),jsonb_build_object('collector_ref',p_ref),p_notes);return jsonb_build_object('status','released');end $$;
create function public.release_asset(p_order uuid,p_token text,p_collector text,p_ref text,p_notes text) returns jsonb language sql security invoker set search_path='' as $$select private.release_asset(p_order,p_token,p_collector,p_ref,p_notes)$$;

create function private.require_service() returns void language plpgsql set search_path='' as $$begin if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service credential required';end if;end$$;
create function private.confirm_verified_payment(p_tx_ref text,p_amount numeric,p_currency text,p_provider_ref text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare p public.payments;o public.orders;s public.settlements;rule public.fee_rules;outstanding numeric;fees numeric;pool numeric;recovery numeric;surplus numeric;shortfall numeric;begin perform private.require_service();select * into p from public.payments where tx_ref=p_tx_ref for update;if p.id is null then raise exception 'Unknown payment';end if;select * into o from public.orders where id=p.order_id for update;
 if p.amount<>p_amount or o.amount_due<>p_amount or p.currency<>p_currency or o.currency<>p_currency then raise exception 'Payment amount or currency mismatch';end if;
 if p.status='paid' then return jsonb_build_object('status','paid','id',p.id);end if;
 if o.status<>'awaiting_payment' then raise exception 'Late or unavailable order payment needs finance review';end if;
 update public.payments set status='paid',verified_at=now(),provider_transaction_id=p_provider_ref,verification_payload=p_payload where id=p.id;update public.orders set status='paid',paid_at=now() where id=o.id;update public.listings set status='sold' where id=o.listing_id;update public.collateral_assets set status='sold' where id=(select asset_id from public.listings where id=o.listing_id);
 select * into rule from public.fee_rules where is_active and effective_at<=now() order by effective_at desc limit 1;if rule.version is null then raise exception 'Approved fee rule required';end if;
 select b.outstanding_amount into outstanding from public.loans_bridge b join public.collateral_assets a on a.loan_bridge_id=b.id join public.listings l on l.asset_id=a.id where l.id=o.listing_id;
 if outstanding is null then raise exception 'Loan bridge required';end if;fees=round(p_amount*rule.platform_bps/10000,2)+rule.fixed_fee;if fees>p_amount then raise exception 'Fees exceed sale';end if;pool=p_amount-fees;recovery=least(pool,outstanding);surplus=greatest(pool-outstanding,0);shortfall=greatest(outstanding-pool,0);
 insert into public.settlements(order_id,gross_sale,rule_version,created_by) values(o.id,p_amount,rule.version,o.buyer_id) returning * into s;
 insert into public.settlement_lines(settlement_id,line_type,direction,amount) values(s.id,'GROSS_SALE',1,p_amount),(s.id,'PLATFORM_COMMISSION',-1,round(p_amount*rule.platform_bps/10000,2)),(s.id,'OTHER_APPROVED_COST',-1,rule.fixed_fee),(s.id,'RECOVERY_TO_LOAN',-1,recovery),(s.id,'OWNER_SURPLUS',-1,surplus),(s.id,'SHORTFALL',1,shortfall);
 insert into public.notifications(user_id,kind,message,entity_id) values(o.buyer_id,'payment_verified','Payment verified. Awaiting staff collection approval.',o.id);perform private.log_event('payment.verified','payment',p.id::text,null,p_payload);return jsonb_build_object('status','paid','id',p.id,'settlement_id',s.id);end $$;
create function public.confirm_verified_payment(p_tx_ref text,p_amount numeric,p_currency text,p_provider_ref text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.confirm_verified_payment(p_tx_ref,p_amount,p_currency,p_provider_ref,p_payload)$$;

create function private.close_auctions() returns integer language plpgsql security definer set search_path='' as $$ declare a record;u public.auctions;l public.listings;n integer:=0;begin perform private.require_service();for a in select listing_id from public.auctions where ends_at<=clock_timestamp() and closed_at is null order by listing_id loop select * into l from public.listings where id=a.listing_id for update;select * into u from public.auctions where listing_id=a.listing_id for update;if u.closed_at is not null or u.ends_at>clock_timestamp() then continue;end if;update public.auctions set closed_at=now(),winner_user_id=case when reserve_met then current_bidder_id end where listing_id=u.listing_id;if l.status='live' and u.current_bidder_id is not null and u.reserve_met then perform private.reserve_order(l.id,'auction_win',u.current_bidder_id,u.current_price);insert into public.notifications(user_id,kind,message,entity_id) values(u.current_bidder_id,'auction_won','You won an auction. Complete payment before the deadline.',l.id);elsif l.status='live' then update public.listings set status='ended' where id=l.id;end if;perform private.log_event('auction.closed','auction',l.id::text,null,to_jsonb(u));n=n+1;end loop;return n;end $$;
create function public.close_auctions() returns integer language sql security invoker set search_path='' as $$select private.close_auctions()$$;
create function private.expire_reservations() returns integer language plpgsql security definer set search_path='' as $$declare o record;n integer:=0;begin perform private.require_service();for o in select * from public.orders where status='awaiting_payment' and payment_deadline<now() for update skip locked loop
 -- A pending provider attempt blocks automatic relisting until reconciliation proves it failed.
 if exists(select 1 from public.payments where order_id=o.id and status in ('pending','verifying','created')) then continue;end if;
 update public.orders set status='cancelled' where id=o.id;update public.listings set status=case when method in ('auction','auction_plus_buy_now') then 'ended'::public.listing_status else 'live'::public.listing_status end where id=o.listing_id;perform private.log_event('order.expired','order',o.id::text,null,null);n=n+1;end loop;return n;end $$;
create function public.expire_reservations() returns integer language sql security invoker set search_path='' as $$select private.expire_reservations()$$;

-- Restrict function execution explicitly. The private schema is not exposed by PostgREST.
revoke all on all functions in schema private from public,anon,authenticated;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['place_bid','buy_now','submit_offer','bid_history','create_asset','request_authorization','create_listing','request_change','approve_action','decide_offer','release_asset','confirm_verified_payment','close_auctions','expire_reservations']) loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;end$$;
grant execute on function private.staff_level() to authenticated;
grant execute on function private.place_bid(uuid,numeric),private.buy_now(uuid),private.submit_offer(uuid,numeric,text),private.create_asset(jsonb),private.request_authorization(uuid,jsonb),private.create_listing(jsonb),private.request_change(text,uuid,jsonb),private.approve_action(uuid,text,text),private.decide_offer(uuid,text,numeric,text),private.release_asset(uuid,text,text,text,text) to authenticated;
grant execute on function public.place_bid(uuid,numeric),public.buy_now(uuid),public.submit_offer(uuid,numeric,text),public.create_asset(jsonb),public.request_authorization(uuid,jsonb),public.create_listing(jsonb),public.request_change(text,uuid,jsonb),public.approve_action(uuid,text,text),public.decide_offer(uuid,text,numeric,text),public.release_asset(uuid,text,text,text,text) to authenticated;
grant execute on function private.bid_history(uuid),public.bid_history(uuid) to anon,authenticated;
grant execute on function private.confirm_verified_payment(text,numeric,text,text,jsonb),public.confirm_verified_payment(text,numeric,text,text,jsonb),private.close_auctions(),public.close_auctions(),private.expire_reservations(),public.expire_reservations() to service_role;
grant execute on all functions in schema private to service_role;
grant usage,select on all sequences in schema public to service_role;

-- Public listing photographs and staff-only evidence stay in separate buckets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('listing-images','listing-images',true,5242880,array['image/jpeg','image/png','image/webp']),('private-evidence','private-evidence',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy public_listing_photos on storage.objects for select to anon,authenticated using(bucket_id='listing-images');
create policy staff_upload on storage.objects for insert to authenticated with check(bucket_id in ('listing-images','private-evidence') and private.staff_level()>=2);
create policy staff_private_read on storage.objects for select to authenticated using(bucket_id='private-evidence' and private.staff_level()>=2);

alter table public.payments add column checkout_url text;
create function private.begin_payment(p_order uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare actor uuid;o public.orders;p public.payments;begin actor=private.require_buyer();perform private.consume_rate(actor::text,'payment',5);select * into o from public.orders where id=p_order for update;if o.buyer_id<>actor or o.id is null or o.status<>'awaiting_payment' or o.payment_deadline<=now() then raise exception 'Order not eligible for payment';end if;select * into p from public.payments where order_id=o.id and status in ('pending','verifying') order by created_at desc limit 1;if p.id is not null then if p.checkout_url is null then raise exception 'A payment session is being prepared or needs reconciliation';end if;return jsonb_build_object('checkout_url',p.checkout_url);end if;insert into public.payments(order_id,tx_ref,currency,amount,status) values(o.id,'CMRP-'||gen_random_uuid()::text,o.currency,o.amount_due,'pending') returning * into p;return jsonb_build_object('tx_ref',p.tx_ref,'amount',p.amount,'currency',p.currency);end $$;
create function public.begin_payment(p_order uuid) returns jsonb language sql security invoker set search_path='' as $$select private.begin_payment(p_order)$$;
revoke all on function private.begin_payment(uuid),public.begin_payment(uuid) from public,anon,authenticated;
grant execute on function private.begin_payment(uuid),public.begin_payment(uuid) to authenticated;
create function private.sync_loan(p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare b public.loans_bridge;begin perform private.require_service();insert into public.loans_bridge(source_system,external_loan_id,external_collateral_id,borrower_reference,outstanding_amount,currency,recovery_status,source_version) values(p_values->>'source_system',p_values->>'external_loan_id',p_values->>'external_collateral_id',p_values->>'borrower_reference',(p_values->>'outstanding_amount')::numeric,p_values->>'currency',p_values->>'recovery_status',p_values->>'source_version') on conflict(source_system,external_loan_id) do update set outstanding_amount=excluded.outstanding_amount,recovery_status=excluded.recovery_status,source_version=excluded.source_version,last_synced_at=now() where public.loans_bridge.source_version is distinct from excluded.source_version returning * into b;perform private.log_event('loan.synced','loan',b.id::text,null,to_jsonb(b));return coalesce(to_jsonb(b),jsonb_build_object('duplicate',true));end $$;
create function public.sync_loan(p_values jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.sync_loan(p_values)$$;
revoke all on function private.sync_loan(jsonb),public.sync_loan(jsonb) from public,anon,authenticated;
grant execute on function private.sync_loan(jsonb),public.sync_loan(jsonb) to service_role;
create function private.log_export(p_report text) returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.require_staff(1);perform private.log_event('report.exported','report',p_report);return jsonb_build_object('recorded',true);end $$;
create function public.log_export(p_report text) returns jsonb language sql security invoker set search_path='' as $$select private.log_export(p_report)$$;
revoke all on function private.log_export(text),public.log_export(text) from public,anon,authenticated;
grant execute on function private.log_export(text),public.log_export(text) to authenticated;

create function private.accept_counteroffer(p_offer uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare actor uuid;o public.offers;l public.listings;begin actor=private.require_buyer();select listing_id into l.id from public.offers where id=p_offer;select * into l from public.listings where id=l.id for update;select * into o from public.offers where id=p_offer for update;if o.id is null or o.buyer_id<>actor or o.proposed_by<>'seller' or o.status<>'open' or o.expires_at<=now() or l.status<>'live' then raise exception 'Counteroffer is not available';end if;update public.offers set status='converted' where id=o.id;perform private.log_event('counteroffer.accepted','offer',o.id::text,to_jsonb(o));return private.reserve_order(l.id,'accepted_offer',actor,o.amount,o.id);end$$;
create function public.accept_counteroffer(p_offer uuid) returns jsonb language sql security invoker set search_path='' as $$select private.accept_counteroffer(p_offer)$$;
revoke all on function private.accept_counteroffer(uuid),public.accept_counteroffer(uuid) from public,anon,authenticated;
grant execute on function private.accept_counteroffer(uuid),public.accept_counteroffer(uuid) to authenticated;
-- Publish only the public-safe projection. Never publish raw bidder/loan tables.
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.public_catalog;end if;end$$;
create function private.mark_payment_failed(p_tx_ref text) returns jsonb language plpgsql security definer set search_path='' as $$declare p public.payments;begin perform private.require_service();select * into p from public.payments where tx_ref=p_tx_ref for update;if p.id is null then raise exception 'Unknown payment';end if;if p.status='paid' then return jsonb_build_object('status','paid');end if;update public.payments set status='failed',verified_at=now() where id=p.id;perform private.log_event('payment.failed','payment',p.id::text,null,jsonb_build_object('tx_ref',p_tx_ref));return jsonb_build_object('status','failed');end$$;
create function public.mark_payment_failed(p_tx_ref text) returns jsonb language sql security invoker set search_path='' as $$select private.mark_payment_failed(p_tx_ref)$$;
revoke all on function private.mark_payment_failed(text),public.mark_payment_failed(text) from public,anon,authenticated;
grant execute on function private.mark_payment_failed(text),public.mark_payment_failed(text) to service_role;

create function private.dashboard_metrics() returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;chart jsonb;max_month numeric;begin perform private.require_staff(1);select jsonb_build_object('gross',coalesce(sum(amount) filter(where line_type='GROSS_SALE'),0),'recovered',coalesce(sum(amount) filter(where line_type='RECOVERY_TO_LOAN'),0),'surplus',coalesce(sum(amount) filter(where line_type='OWNER_SURPLUS'),0),'fees',coalesce(sum(amount) filter(where line_type in ('PLATFORM_COMMISSION','OTHER_APPROVED_COST','PAYMENT_FEE','SALE_AGENT_COMMISSION')),0)) into result from public.settlement_lines sl join public.settlements st on st.id=sl.settlement_id where st.status in ('approved','posted_to_loan','closed');
with months as(select generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') as month),values_by_month as(select m.month,coalesce(sum(sl.amount),0) as value from months m left join public.settlements st on date_trunc('month',st.created_at)=m.month and st.status in ('approved','posted_to_loan','closed') left join public.settlement_lines sl on sl.settlement_id=st.id and sl.line_type='RECOVERY_TO_LOAN' group by m.month) select jsonb_agg(jsonb_build_object('month',to_char(month,'Mon'),'amount',amount) order by month) into chart from (select month,case when max(value) over()>0 then round(100*value/max(value) over(),2) else 0 end as amount from values_by_month) scaled;
return jsonb_build_object('kpis',result,'chart',coalesce(chart,'[]'));end$$;
create function public.dashboard_metrics() returns jsonb language sql security invoker set search_path='' as $$select private.dashboard_metrics()$$;
revoke all on function private.dashboard_metrics(),public.dashboard_metrics() from public,anon,authenticated;
grant execute on function private.dashboard_metrics(),public.dashboard_metrics() to authenticated;

-- Allow standalone collateral and settle proceeds without loan recovery.
create or replace function private.create_asset(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  loan uuid;
  a public.collateral_assets;
begin
  actor=private.require_staff(2);
  if nullif(btrim(p_values->>'external_loan_id'),'') is not null then
    select id into loan
    from public.loans_bridge
    where external_loan_id=btrim(p_values->>'external_loan_id');
    if loan is null then
      raise exception 'Loan not synchronized. Import via the loan bridge first.';
    end if;
  end if;

  insert into public.collateral_assets(
    loan_bridge_id,asset_ref,title,category,valuation_amount,
    custody_location,condition_notes,created_by
  ) values(
    loan,p_values->>'asset_ref',p_values->>'title',p_values->>'category',
    (p_values->>'valuation_amount')::numeric,p_values->>'custody_location',
    p_values->>'condition_notes',actor
  ) returning * into a;
  perform private.log_event(
    'asset.created','asset',a.id::text,null,to_jsonb(a),p_values->>'reason'
  );
  return to_jsonb(a);
end
$$;

create or replace function private.confirm_verified_payment(
  p_tx_ref text,
  p_amount numeric,
  p_currency text,
  p_provider_ref text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.payments;
  o public.orders;
  s public.settlements;
  rule public.fee_rules;
  outstanding numeric;
  linked_loan uuid;
  fees numeric;
  pool numeric;
  recovery numeric;
  surplus numeric;
  shortfall numeric;
begin
  perform private.require_service();
  select * into p from public.payments where tx_ref=p_tx_ref for update;
  if p.id is null then raise exception 'Unknown payment'; end if;
  select * into o from public.orders where id=p.order_id for update;
  if p.amount<>p_amount or o.amount_due<>p_amount or p.currency<>p_currency or o.currency<>p_currency then
    raise exception 'Payment amount or currency mismatch';
  end if;
  if p.status='paid' then return jsonb_build_object('status','paid','id',p.id); end if;
  if o.status<>'awaiting_payment' then
    raise exception 'Late or unavailable order payment needs finance review';
  end if;

  select a.loan_bridge_id,coalesce(b.outstanding_amount,0)
  into linked_loan,outstanding
  from public.listings l
  join public.collateral_assets a on a.id=l.asset_id
  left join public.loans_bridge b on b.id=a.loan_bridge_id
  where l.id=o.listing_id;
  if not found then raise exception 'Listing collateral not found'; end if;

  update public.payments
  set status='paid',verified_at=now(),provider_transaction_id=p_provider_ref,
      verification_payload=p_payload
  where id=p.id;
  update public.orders set status='paid',paid_at=now() where id=o.id;
  update public.listings set status='sold' where id=o.listing_id;
  update public.collateral_assets set status='sold'
  where id=(select asset_id from public.listings where id=o.listing_id);

  select * into rule from public.fee_rules
  where is_active and effective_at<=now()
  order by effective_at desc limit 1;
  if rule.version is null then raise exception 'Approved fee rule required'; end if;
  fees=round(p_amount*rule.platform_bps/10000,2)+rule.fixed_fee;
  if fees>p_amount then raise exception 'Fees exceed sale'; end if;
  pool=p_amount-fees;
  recovery=least(pool,outstanding);
  surplus=greatest(pool-outstanding,0);
  shortfall=greatest(outstanding-pool,0);

  insert into public.settlements(
    order_id,gross_sale,rule_version,created_by,loan_sync
  ) values(
    o.id,p_amount,rule.version,o.buyer_id,
    case when linked_loan is null then 'not_applicable' else 'pending' end
  ) returning * into s;
  insert into public.settlement_lines(settlement_id,line_type,direction,amount)
  values
    (s.id,'GROSS_SALE',1,p_amount),
    (s.id,'PLATFORM_COMMISSION',-1,round(p_amount*rule.platform_bps/10000,2)),
    (s.id,'OTHER_APPROVED_COST',-1,rule.fixed_fee),
    (s.id,'RECOVERY_TO_LOAN',-1,recovery),
    (s.id,'OWNER_SURPLUS',-1,surplus),
    (s.id,'SHORTFALL',1,shortfall);
  insert into public.notifications(user_id,kind,message,entity_id)
  values(o.buyer_id,'payment_verified',
    'Payment verified. Awaiting staff collection approval.',o.id);
  perform private.log_event('payment.verified','payment',p.id::text,null,p_payload);
  return jsonb_build_object('status','paid','id',p.id,'settlement_id',s.id);
end
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  name=excluded.name,
  public=true,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='public_listing_photos'
  ) then
    execute 'create policy public_listing_photos on storage.objects for select to anon,authenticated using(bucket_id=''listing-images'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='staff_listing_image_upload'
  ) then
    execute 'create policy staff_listing_image_upload on storage.objects for insert to authenticated with check(bucket_id=''listing-images'' and private.staff_level()>=2)';
  end if;
end
$$;

-- Preserve MFA enforcement for configured staff while allowing documented exceptions.
update public.staff_profiles
set mfa_required=true
where security_level>=3 and not mfa_required;

create or replace function private.staff_level()
returns smallint
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select security_level
    from public.staff_profiles
    where user_id=auth.uid()
      and is_active
      and (not mfa_required or (auth.jwt()->>'aal')='aal2')
  ),0)::smallint
$$;
alter table public.orders alter column buyer_id drop not null;
alter table public.orders add column if not exists buyer_name text;
alter table public.orders add column if not exists buyer_contact text;
alter table public.orders add column if not exists payment_method text not null default 'online';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.orders'::regclass
      and conname='orders_payment_method_check'
  ) then
    alter table public.orders
      add constraint orders_payment_method_check
      check(payment_method in ('online','cash'));
  end if;
end
$$;

create unique index if not exists cash_payment_receipt_unique
  on public.payments(lower(provider_transaction_id))
  where provider='cash' and provider_transaction_id is not null;

create or replace function private.record_cash_sale(
  p_listing uuid,
  p_receipt_ref text,
  p_buyer_name text,
  p_buyer_contact text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  l public.listings;
  a public.collateral_assets;
  o public.orders;
  settlement_row public.settlements;
  rule_row public.fee_rules;
  outstanding numeric:=0;
  price numeric;
  fees numeric;
  pool numeric;
  recovery numeric;
  surplus numeric;
  shortfall numeric;
begin
  actor=private.require_staff(3);
  if length(trim(coalesce(p_receipt_ref,'')))<1 or length(trim(p_receipt_ref))>100 then
    raise exception 'Enter a valid cash receipt reference';
  end if;
  if length(trim(coalesce(p_buyer_name,'')))<1 or length(trim(p_buyer_name))>120 then
    raise exception 'Enter the cash buyer name';
  end if;
  if length(trim(coalesce(p_buyer_contact,'')))>100 then
    raise exception 'Buyer contact is too long';
  end if;
  if length(trim(coalesce(p_reason,'')))<3 or length(trim(p_reason))>500 then
    raise exception 'Enter a sale note of 3 to 500 characters';
  end if;

  select * into l from public.listings where id=p_listing for update;
  if l.id is null or l.status<>'live' or l.fixed_price is null
     or l.method not in ('fixed_price','fixed_plus_offer','auction_plus_buy_now') then
    raise exception 'Cash recording is available only for live fixed-price listings';
  end if;
  if l.method='auction_plus_buy_now'
     and exists(select 1 from public.bids where auction_listing_id=l.id) then
    raise exception 'Buy now is disabled after the first auction bid';
  end if;
  select * into a from public.collateral_assets where id=l.asset_id for update;
  if a.id is null then raise exception 'Listing asset not found'; end if;

  price=l.fixed_price;
  select * into rule_row from public.fee_rules
  where is_active and effective_at<=now()
  order by effective_at desc limit 1;
  if rule_row.version is null then raise exception 'Approved fee rule required'; end if;
  fees=round(price*rule_row.platform_bps/10000,2)+rule_row.fixed_fee;
  if fees>price then raise exception 'Fees exceed sale'; end if;
  pool=price-fees;
  if a.loan_bridge_id is not null then
    select outstanding_amount into outstanding
    from public.loans_bridge where id=a.loan_bridge_id;
    if not found then raise exception 'Linked loan record not found'; end if;
  end if;
  recovery=least(pool,outstanding);
  surplus=greatest(pool-outstanding,0);
  shortfall=greatest(outstanding-pool,0);

  insert into public.orders(
    order_no,listing_id,buyer_id,source,currency,amount_due,status,paid_at,
    buyer_name,buyer_contact,payment_method
  ) values(
    'ORD-'||to_char(now(),'YYYY')||'-CASH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    l.id,null,'fixed_price',l.currency,price,'paid',now(),
    trim(p_buyer_name),nullif(trim(p_buyer_contact),''),'cash'
  ) returning * into o;

  insert into public.payments(
    order_id,provider,tx_ref,provider_transaction_id,currency,amount,status,
    verification_payload,verified_at
  ) values(
    o.id,'cash','CASH-'||gen_random_uuid()::text,trim(p_receipt_ref),
    o.currency,price,'paid',
    jsonb_build_object('receipt_ref',trim(p_receipt_ref),'recorded_by',actor::text,'note',trim(p_reason)),
    now()
  );

  update public.listings set status='sold' where id=l.id;
  update public.collateral_assets set status='sold' where id=a.id;
  insert into public.settlements(order_id,gross_sale,rule_version,created_by,loan_sync)
  values(o.id,price,rule_row.version,actor,
    case when a.loan_bridge_id is null then 'not_applicable' else 'pending' end
  ) returning * into settlement_row;
  insert into public.settlement_lines(settlement_id,line_type,direction,amount)
  values
    (settlement_row.id,'GROSS_SALE',1,price),
    (settlement_row.id,'PLATFORM_COMMISSION',-1,round(price*rule_row.platform_bps/10000,2)),
    (settlement_row.id,'OTHER_APPROVED_COST',-1,rule_row.fixed_fee),
    (settlement_row.id,'RECOVERY_TO_LOAN',-1,recovery),
    (settlement_row.id,'OWNER_SURPLUS',-1,surplus),
    (settlement_row.id,'SHORTFALL',1,shortfall);
  perform private.log_event(
    'cash_sale.recorded','order',o.id::text,null,
    jsonb_build_object(
      'listing_id',l.id,'listing_title',l.public_title,'amount',price,
      'currency',o.currency,'payment_method','cash',
      'receipt_ref',trim(p_receipt_ref),'buyer_name',trim(p_buyer_name)
    ),
    trim(p_reason)
  );
  return jsonb_build_object(
    'status','paid','order_id',o.id,'order_no',o.order_no,
    'amount',price,'settlement_id',settlement_row.id
  );
end
$$;

create or replace function public.record_cash_sale(
  p_listing uuid,
  p_receipt_ref text,
  p_buyer_name text,
  p_buyer_contact text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.record_cash_sale(p_listing,p_receipt_ref,p_buyer_name,p_buyer_contact,p_reason)$$;
revoke all on function private.record_cash_sale(uuid,text,text,text,text),public.record_cash_sale(uuid,text,text,text,text) from public,anon;
grant execute on function private.record_cash_sale(uuid,text,text,text,text),public.record_cash_sale(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_audit_log()
returns table(
  id bigint,
  occurred_at timestamptz,
  actor text,
  actor_level smallint,
  action text,
  entity_type text,
  entity_id text,
  reason text,
  source text
)
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.require_staff(1);
  return query
  select e.id,e.occurred_at,
    coalesce(s.full_name,e.actor_user_id::text,'System'),
    e.actor_level,e.action,e.entity_type,e.entity_id,e.reason,e.source
  from public.audit_events e
  left join public.staff_profiles s on s.user_id=e.actor_user_id
  order by e.occurred_at desc,e.id desc
  limit 500;
end
$$;
revoke all on function public.admin_audit_log() from public,anon;
grant execute on function public.admin_audit_log() to authenticated;

create or replace function private.approve_action(
  p_request uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  r public.approval_requests;
  v jsonb;
  s public.settlements;
  o public.orders;
  authorization_row public.sale_authorizations;
  total numeric;
  token text;
  cash_release_code text;
begin
  actor=private.require_staff(3);
  select * into r from public.approval_requests where id=p_request for update;
  if r.id is null or r.status<>'pending' or r.requested_by=actor
     or private.staff_level()<r.required_min_level
     or p_decision not in ('approved','rejected') or length(trim(p_reason))<3 then
    raise exception 'Independent eligible approver and reason required';
  end if;
  v=r.proposed_values;
  if p_decision='approved' then
    case r.action_type
      when 'sale_authorization' then
        select * into authorization_row from public.sale_authorizations where id=r.entity_id for update;
        update public.sale_authorizations set status='approved',decided_by=actor,decided_at=now(),decision_reason=p_reason where id=r.entity_id;
        update public.collateral_assets set status='approved_for_sale' where id=authorization_row.asset_id;
      when 'publish_listing' then
        if not exists(select 1 from public.listings l join public.sale_authorizations a on a.id=l.sale_authorization_id and a.asset_id=l.asset_id where l.id=r.entity_id and l.status='pending_approval' and a.status='approved') then
          raise exception 'Sale authorization required';
        end if;
        update public.listings set status='live',approved_by=actor,publish_at=now() where id=r.entity_id;
        update public.collateral_assets set status='listed' where id=(select asset_id from public.listings where id=r.entity_id);
      when 'staff_change' then
        insert into public.staff_profiles(user_id,full_name,security_level,is_active,mfa_required,created_by)
        values((v->>'user_id')::uuid,v->>'full_name',(v->>'security_level')::smallint,(v->>'is_active')::boolean,(v->>'security_level')::integer>=3,actor)
        on conflict(user_id) do update set full_name=excluded.full_name,security_level=excluded.security_level,is_active=excluded.is_active,mfa_required=excluded.mfa_required;
      when 'settings_change' then
        insert into public.system_settings(settings,approved_by) values(v,actor);
      when 'fee_change' then
        insert into public.fee_rules(version,platform_bps,fixed_fee,effective_at,approved_by,is_active)
        values(v->>'version',(v->>'platform_bps')::integer,(v->>'fixed_fee')::numeric,(v->>'effective_at')::timestamptz,actor,true);
      when 'settlement' then
        select * into s from public.settlements where id=r.entity_id for update;
        if s.status<>'draft' or not exists(select 1 from public.orders where id=s.order_id and status in ('paid','released')) then
          raise exception 'Paid draft settlement required';
        end if;
        select sum(direction*amount) into total from public.settlement_lines where settlement_id=s.id and line_type<>'SHORTFALL';
        if total<>0 or total is null then raise exception 'Settlement does not balance'; end if;
        update public.settlements set status='approved',approved_by=actor,approved_at=now() where id=s.id;
        insert into public.integration_outbox(settlement_id,payload)
        select s.id,jsonb_build_object(
          'external_loan_id',b.external_loan_id,
          'marketplace_order_no',ord.order_no,
          'gross_sale',s.gross_sale,
          'currency',s.currency,
          'loan_recovery',(select amount from public.settlement_lines where settlement_id=s.id and line_type='RECOVERY_TO_LOAN'),
          'surplus',(select amount from public.settlement_lines where settlement_id=s.id and line_type='OWNER_SURPLUS'),
          'settled_at',now()
        )
        from public.orders ord
        join public.listings l on l.id=ord.listing_id
        join public.collateral_assets a on a.id=l.asset_id
        join public.loans_bridge b on b.id=a.loan_bridge_id
        where ord.id=s.order_id
        on conflict(settlement_id) do nothing;
      when 'release' then
        select * into o from public.orders where id=r.entity_id for update;
        if o.status<>'paid' then raise exception 'Verified payment required'; end if;
        token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
        insert into public.release_orders(order_id,release_token_hash,status,approved_by,approved_at,prepared_by,collector_name,collector_ref)
        values(o.id,encode(sha256(convert_to(token,'UTF8')),'hex'),'approved',actor,now(),r.requested_by,v->>'collector_name',v->>'collector_ref');
        if o.buyer_id is not null then
          insert into public.notifications(user_id,kind,message,entity_id)
          values(o.buyer_id,'collection_ready','Your collection code: '||token,o.id);
        else
          cash_release_code=token;
        end if;
      else
        raise exception 'Unsupported approval action';
    end case;
  end if;
  update public.approval_requests set status=p_decision::public.approval_status,decided_by=actor,decided_at=now(),decision_reason=p_reason where id=r.id;
  perform private.log_event('approval.'||p_decision,r.entity_type,r.entity_id::text,to_jsonb(r),jsonb_build_object('decision',p_decision),p_reason);
  return jsonb_build_object('status',p_decision,'release_code',cash_release_code);
end
$$;
create or replace function private.create_asset(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  loan uuid;
  asset public.collateral_assets;
begin
  actor=private.require_staff(2);
  if nullif(btrim(p_values->>'external_loan_id'),'') is not null then
    select id into loan
    from public.loans_bridge
    where external_loan_id=btrim(p_values->>'external_loan_id');
    if loan is null then
      raise exception 'Loan not synchronized. Import via the loan bridge first.';
    end if;
  end if;

  insert into public.collateral_assets(
    loan_bridge_id,asset_ref,title,category,valuation_amount,currency,
    custody_location,condition_grade,condition_notes,created_by
  ) values(
    loan,coalesce(
      nullif(btrim(p_values->>'asset_ref'),''),
      'COL-'||to_char(current_date,'YYYY')||'-'||
        upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))
    ),p_values->>'title',p_values->>'category',
    (p_values->>'valuation_amount')::numeric,
    coalesce(nullif(p_values->>'currency',''),'MWK'),
    p_values->>'custody_location',
    coalesce(nullif(p_values->>'condition_grade',''),'Good'),
    nullif(btrim(p_values->>'condition_notes'),''),actor
  ) returning * into asset;

  perform private.log_event(
    'asset.created','asset',asset.id::text,null,to_jsonb(asset),p_values->>'reason'
  );
  return to_jsonb(asset);
end
$$;

create or replace function private.create_listing(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  listing public.listings;
  authorization_row public.sale_authorizations;
  request public.approval_requests;
  config jsonb;
begin
  actor=private.require_staff(2);
  select * into authorization_row
  from public.sale_authorizations
  where id=(p_values->>'sale_authorization_id')::uuid
    and asset_id=(p_values->>'asset_id')::uuid;
  if authorization_row.status<>'approved' or authorization_row.id is null then
    raise exception 'Approved sale authorization required';
  end if;

  insert into public.listings(
    asset_id,sale_authorization_id,slug,method,status,public_title,
    public_description,fixed_price,collection_point,terms_version,image,
    condition_grade,defects,created_by
  ) values(
    authorization_row.asset_id,authorization_row.id,p_values->>'slug',
    (p_values->>'method')::public.sale_method,'pending_approval',
    p_values->>'title',p_values->>'description',
    case when p_values->>'method'='auction' then null
      else (p_values->>'price')::numeric end,
    p_values->>'collection_point',p_values->>'terms_version',p_values->>'image',
    coalesce(nullif(p_values->>'condition_grade',''),'Good'),
    p_values->>'defects',actor
  ) returning * into listing;

  if listing.method in ('auction','auction_plus_buy_now') then
    select settings into config
    from public.system_settings
    order by created_at desc
    limit 1;
    insert into public.auctions(
      listing_id,starts_at,ends_at,starting_bid,min_increment,
      extension_window_seconds,extension_seconds,max_extension_count
    ) values(
      listing.id,now(),
      now()+make_interval(hours=>(p_values->>'duration_hours')::integer),
      (p_values->>'price')::numeric,(p_values->>'increment')::numeric,
      (config->>'extension_window')::integer,
      (config->>'extension_seconds')::integer,
      (config->>'max_extensions')::integer
    );
  end if;

  insert into public.approval_requests(
    action_type,entity_type,entity_id,requested_by,required_min_level,
    reason,proposed_values
  ) values(
    'publish_listing','listing',listing.id,actor,3,
    p_values->>'reason',p_values
  ) returning * into request;
  perform private.log_event(
    'listing.created','listing',listing.id::text,null,to_jsonb(listing)
  );
  return to_jsonb(listing);
end
$$;
create or replace function private.request_change(p_action text,p_entity uuid,p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  request public.approval_requests;
  required_level integer;
  listing public.listings;
  auction_row public.auctions;
  values_to_save jsonb:=p_values;
  requested_price numeric;
  current_price numeric;
begin
  required_level=case when p_action in ('staff_change','settings_change','fee_change') then 4 else 3 end;
  actor=private.require_staff(case when p_action in ('release','settlement','listing_price_change') then 2 else required_level end);
  if p_action not in ('staff_change','settings_change','fee_change','settlement','release','listing_price_change') then
    raise exception 'Unsupported change';
  end if;
  if p_action='release' and not exists(select 1 from public.orders where id=p_entity and status='paid') then
    raise exception 'Verified paid payment required';
  end if;
  if p_action='settlement' and not exists(select 1 from public.settlements where id=p_entity and status='draft') then
    raise exception 'Draft settlement required';
  end if;

  if p_action='listing_price_change' then
    requested_price=(p_values->>'price')::numeric;
    if requested_price is null or requested_price<=0
       or requested_price<>round(requested_price,2)
       or coalesce(length(trim(p_values->>'reason')),0)<3 then
      raise exception 'A valid positive price and reason are required';
    end if;
    select * into listing from public.listings where id=p_entity for update;
    if listing.id is null or listing.status<>'live' then
      raise exception 'Only live listings can be repriced';
    end if;
    if exists(select 1 from public.approval_requests where action_type='listing_price_change' and entity_id=p_entity and status='pending') then
      raise exception 'A price change is already awaiting approval';
    end if;
    if exists(select 1 from public.orders where listing_id=listing.id and status in ('awaiting_payment','paid','released','closed','disputed')) then
      raise exception 'Price is locked after a purchase starts';
    end if;
    if listing.method in ('auction','auction_plus_buy_now') then
      select * into auction_row from public.auctions where listing_id=listing.id for update;
      if auction_row.listing_id is null or exists(select 1 from public.bids where auction_listing_id=listing.id) then
        raise exception 'Starting bid is locked after bidding starts';
      end if;
      current_price=coalesce(auction_row.current_price,auction_row.starting_bid);
    else
      current_price=listing.fixed_price;
    end if;
    if current_price is null or requested_price=current_price then
      raise exception 'Enter a different valid price';
    end if;
    values_to_save=p_values||jsonb_build_object(
      'title',listing.public_title,
      'method',listing.method::text,
      'old_price',current_price
    );
  end if;

  insert into public.approval_requests(
    action_type,entity_type,entity_id,requested_by,required_min_level,
    reason,proposed_values
  ) values(
    p_action,
    case when p_action='listing_price_change' then 'listing' else p_action end,
    p_entity,actor,required_level,
    coalesce(p_values->>'reason','Operational review requested'),values_to_save
  ) returning * into request;
  perform private.log_event('approval.requested',request.entity_type,p_entity::text,null,to_jsonb(request));
  return to_jsonb(request);
end
$$;

create or replace function private.approve_action(p_request uuid,p_decision text,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  request public.approval_requests;
  proposal jsonb;
  settlement public.settlements;
  order_row public.orders;
  listing_row public.listings;
  auction_row public.auctions;
  authorization_row public.sale_authorizations;
  total numeric;
  token text;
  cash_release_code text;
begin
  actor=private.require_staff(3);
  select * into request from public.approval_requests where id=p_request for update;
  if request.id is null or request.status<>'pending' or request.requested_by=actor
     or private.staff_level()<request.required_min_level
     or p_decision not in ('approved','rejected') or length(trim(p_reason))<3 then
    raise exception 'Independent eligible approver and reason required';
  end if;
  proposal=request.proposed_values;

  if p_decision='approved' then
    case request.action_type
      when 'sale_authorization' then
        select * into authorization_row from public.sale_authorizations where id=request.entity_id for update;
        update public.sale_authorizations set status='approved',decided_by=actor,decided_at=now(),decision_reason=p_reason where id=request.entity_id;
        update public.collateral_assets set status='approved_for_sale' where id=authorization_row.asset_id;
      when 'publish_listing' then
        if not exists(select 1 from public.listings l join public.sale_authorizations a on a.id=l.sale_authorization_id and a.asset_id=l.asset_id where l.id=request.entity_id and l.status='pending_approval' and a.status='approved') then
          raise exception 'Sale authorization required';
        end if;
        update public.listings set status='live',approved_by=actor,publish_at=now() where id=request.entity_id;
        update public.collateral_assets set status='listed' where id=(select asset_id from public.listings where id=request.entity_id);
      when 'listing_price_change' then
        select * into listing_row from public.listings where id=request.entity_id for update;
        if listing_row.id is null or listing_row.status<>'live'
           or listing_row.method::text<>proposal->>'method' then
          raise exception 'Listing changed or is no longer live';
        end if;
        if exists(select 1 from public.orders where listing_id=listing_row.id and status in ('awaiting_payment','paid','released','closed','disputed')) then
          raise exception 'Price is locked after a purchase starts';
        end if;
        if listing_row.method in ('auction','auction_plus_buy_now') then
          select * into auction_row from public.auctions where listing_id=listing_row.id for update;
          if auction_row.listing_id is null or exists(select 1 from public.bids where auction_listing_id=listing_row.id) then
            raise exception 'Starting bid is locked after bidding starts';
          end if;
          if coalesce(auction_row.current_price,auction_row.starting_bid)<>(proposal->>'old_price')::numeric then
            raise exception 'Listing price changed since this request was submitted';
          end if;
          update public.auctions set starting_bid=(proposal->>'price')::numeric where listing_id=listing_row.id;
          if listing_row.method='auction_plus_buy_now' then
            update public.listings set fixed_price=(proposal->>'price')::numeric where id=listing_row.id;
          end if;
        else
          if listing_row.fixed_price is null or listing_row.fixed_price<>(proposal->>'old_price')::numeric then
            raise exception 'Listing price changed since this request was submitted';
          end if;
          update public.listings set fixed_price=(proposal->>'price')::numeric where id=listing_row.id;
        end if;
      when 'staff_change' then
        insert into public.staff_profiles(user_id,full_name,security_level,is_active,mfa_required,created_by)
        values((proposal->>'user_id')::uuid,proposal->>'full_name',(proposal->>'security_level')::smallint,(proposal->>'is_active')::boolean,(proposal->>'security_level')::integer>=3,actor)
        on conflict(user_id) do update set full_name=excluded.full_name,security_level=excluded.security_level,is_active=excluded.is_active,mfa_required=excluded.mfa_required;
      when 'settings_change' then
        insert into public.system_settings(settings,approved_by) values(proposal,actor);
      when 'fee_change' then
        insert into public.fee_rules(version,platform_bps,fixed_fee,effective_at,approved_by,is_active)
        values(proposal->>'version',(proposal->>'platform_bps')::integer,(proposal->>'fixed_fee')::numeric,(proposal->>'effective_at')::timestamptz,actor,true);
      when 'settlement' then
        select * into settlement from public.settlements where id=request.entity_id for update;
        if settlement.status<>'draft' or not exists(select 1 from public.orders where id=settlement.order_id and status in ('paid','released')) then
          raise exception 'Paid draft settlement required';
        end if;
        select sum(direction*amount) into total from public.settlement_lines where settlement_id=settlement.id and line_type<>'SHORTFALL';
        if total<>0 or total is null then raise exception 'Settlement does not balance'; end if;
        update public.settlements set status='approved',approved_by=actor,approved_at=now() where id=settlement.id;
        insert into public.integration_outbox(settlement_id,payload)
        select settlement.id,jsonb_build_object(
          'external_loan_id',bridge.external_loan_id,
          'marketplace_order_no',order_record.order_no,
          'gross_sale',settlement.gross_sale,
          'currency',settlement.currency,
          'loan_recovery',(select amount from public.settlement_lines where settlement_id=settlement.id and line_type='RECOVERY_TO_LOAN'),
          'surplus',(select amount from public.settlement_lines where settlement_id=settlement.id and line_type='OWNER_SURPLUS'),
          'settled_at',now()
        )
        from public.orders order_record
        join public.listings sale_listing on sale_listing.id=order_record.listing_id
        join public.collateral_assets asset on asset.id=sale_listing.asset_id
        join public.loans_bridge bridge on bridge.id=asset.loan_bridge_id
        where order_record.id=settlement.order_id
        on conflict(settlement_id) do nothing;
      when 'release' then
        select * into order_row from public.orders where id=request.entity_id for update;
        if order_row.status<>'paid' then raise exception 'Verified payment required'; end if;
        token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
        insert into public.release_orders(order_id,release_token_hash,status,approved_by,approved_at,prepared_by,collector_name,collector_ref)
        values(order_row.id,encode(sha256(convert_to(token,'UTF8')),'hex'),'approved',actor,now(),request.requested_by,proposal->>'collector_name',proposal->>'collector_ref');
        if order_row.buyer_id is not null then
          insert into public.notifications(user_id,kind,message,entity_id)
          values(order_row.buyer_id,'collection_ready','Your collection code: '||token,order_row.id);
        else
          cash_release_code=token;
        end if;
      else
        raise exception 'Unsupported approval action';
    end case;
  end if;

  update public.approval_requests set status=p_decision::public.approval_status,decided_by=actor,decided_at=now(),decision_reason=p_reason where id=request.id;
  perform private.log_event('approval.'||p_decision,request.entity_type,request.entity_id::text,to_jsonb(request),jsonb_build_object('decision',p_decision),p_reason);
  return jsonb_build_object('status',p_decision,'release_code',cash_release_code);
end
$$;
create or replace function private.create_asset(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  loan uuid;
  asset public.collateral_assets;
begin
  actor=private.require_staff(2);
  if nullif(btrim(p_values->>'external_loan_id'),'') is not null then
    select id into loan
    from public.loans_bridge
    where external_loan_id=btrim(p_values->>'external_loan_id');
    if loan is null then
      raise exception 'Loan not synchronized. Import via the loan bridge first.';
    end if;
  end if;

  insert into public.collateral_assets(
    loan_bridge_id,asset_ref,title,category,valuation_amount,currency,
    custody_location,condition_grade,condition_notes,created_by
  ) values(
    loan,coalesce(
      nullif(btrim(p_values->>'asset_ref'),''),
      'COL-'||to_char(current_date,'YYYY')||'-'||
        upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))
    ),p_values->>'title',p_values->>'category',
    (p_values->>'valuation_amount')::numeric,
    coalesce(nullif(p_values->>'currency',''),'MWK'),
    p_values->>'custody_location',
    coalesce(nullif(p_values->>'condition_grade',''),'Good'),
    nullif(btrim(p_values->>'condition_notes'),''),actor
  ) returning * into asset;

  if nullif(p_values->>'image_path','') is not null then
    if p_values->>'image_path' not like 'assets/%' then
      raise exception 'Invalid collateral image path';
    end if;
    insert into public.asset_media(asset_id,storage_path,media_type,sort_order,created_by)
    values(asset.id,p_values->>'image_path','public_image',0,actor);
  end if;

  perform private.log_event(
    'asset.created','asset',asset.id::text,null,to_jsonb(asset),p_values->>'reason'
  );
  return to_jsonb(asset);
end
$$;
alter table public.listings
  add column if not exists images text[] not null default '{}'::text[];
alter table public.public_catalog
  add column if not exists images text[] not null default '{}'::text[];

update public.listings
set images=array[image]
where cardinality(images)=0 and nullif(image,'') is not null;
update public.public_catalog
set images=array[image]
where cardinality(images)=0 and nullif(image,'') is not null;

create unique index if not exists asset_media_asset_path_unique
  on public.asset_media(asset_id,storage_path);

create or replace function private.create_asset(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  loan uuid;
  asset public.collateral_assets;
  image_paths jsonb;
  image_record record;
begin
  actor=private.require_staff(2);
  if nullif(btrim(p_values->>'external_loan_id'),'') is not null then
    select id into loan
    from public.loans_bridge
    where external_loan_id=btrim(p_values->>'external_loan_id');
    if loan is null then
      raise exception 'Loan not synchronized. Import via the loan bridge first.';
    end if;
  end if;

  insert into public.collateral_assets(
    loan_bridge_id,asset_ref,title,category,valuation_amount,currency,
    custody_location,condition_grade,condition_notes,created_by
  ) values(
    loan,coalesce(
      nullif(btrim(p_values->>'asset_ref'),''),
      'COL-'||to_char(current_date,'YYYY')||'-'||
        upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))
    ),p_values->>'title',p_values->>'category',
    (p_values->>'valuation_amount')::numeric,
    coalesce(nullif(p_values->>'currency',''),'MWK'),
    p_values->>'custody_location',
    coalesce(nullif(p_values->>'condition_grade',''),'Good'),
    nullif(btrim(p_values->>'condition_notes'),''),actor
  ) returning * into asset;

  image_paths=coalesce(
    p_values->'image_paths',
    case when nullif(p_values->>'image_path','') is null
      then '[]'::jsonb else jsonb_build_array(p_values->>'image_path') end
  );
  if jsonb_typeof(image_paths)<>'array' or jsonb_array_length(image_paths)>10 then
    raise exception 'Upload between 0 and 10 collateral images';
  end if;
  for image_record in
    select value,ordinality
    from jsonb_array_elements_text(image_paths) with ordinality as paths(value,ordinality)
    order by ordinality
  loop
    if image_record.value not like 'assets/%' then
      raise exception 'Invalid collateral image path';
    end if;
    insert into public.asset_media(asset_id,storage_path,media_type,sort_order,created_by)
    values(asset.id,image_record.value,'public_image',image_record.ordinality-1,actor);
  end loop;

  perform private.log_event(
    'asset.created','asset',asset.id::text,null,to_jsonb(asset),p_values->>'reason'
  );
  return to_jsonb(asset);
end
$$;

create or replace function private.create_listing(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  listing public.listings;
  authorization_row public.sale_authorizations;
  request public.approval_requests;
  config jsonb;
  images text[];
begin
  actor=private.require_staff(2);
  select * into authorization_row
  from public.sale_authorizations
  where id=(p_values->>'sale_authorization_id')::uuid
    and asset_id=(p_values->>'asset_id')::uuid;
  if authorization_row.status<>'approved' or authorization_row.id is null then
    raise exception 'Approved sale authorization required';
  end if;

  if jsonb_typeof(p_values->'images')='array' then
    select array_agg(value order by ordinality) into images
    from jsonb_array_elements_text(p_values->'images') with ordinality as photos(value,ordinality);
  end if;
  if coalesce(cardinality(images),0)=0 and nullif(p_values->>'image','') is not null then
    images=array[p_values->>'image'];
  end if;
  if coalesce(cardinality(images),0)>10 then
    raise exception 'A listing can have no more than 10 images';
  end if;

  insert into public.listings(
    asset_id,sale_authorization_id,slug,method,status,public_title,
    public_description,fixed_price,collection_point,terms_version,image,images,
    condition_grade,defects,created_by
  ) values(
    authorization_row.asset_id,authorization_row.id,p_values->>'slug',
    (p_values->>'method')::public.sale_method,'pending_approval',
    p_values->>'title',p_values->>'description',
    case when p_values->>'method'='auction' then null
      else (p_values->>'price')::numeric end,
    p_values->>'collection_point',p_values->>'terms_version',
    coalesce(nullif(p_values->>'image',''),images[1]),coalesce(images,'{}'::text[]),
    coalesce(nullif(p_values->>'condition_grade',''),'Good'),
    p_values->>'defects',actor
  ) returning * into listing;

  if listing.method in ('auction','auction_plus_buy_now') then
    select settings into config
    from public.system_settings
    order by created_at desc
    limit 1;
    insert into public.auctions(
      listing_id,starts_at,ends_at,starting_bid,min_increment,
      extension_window_seconds,extension_seconds,max_extension_count
    ) values(
      listing.id,now(),
      now()+make_interval(hours=>(p_values->>'duration_hours')::integer),
      (p_values->>'price')::numeric,(p_values->>'increment')::numeric,
      (config->>'extension_window')::integer,
      (config->>'extension_seconds')::integer,
      (config->>'max_extensions')::integer
    );
  end if;

  insert into public.approval_requests(
    action_type,entity_type,entity_id,requested_by,required_min_level,
    reason,proposed_values
  ) values(
    'publish_listing','listing',listing.id,actor,3,
    p_values->>'reason',p_values
  ) returning * into request;
  perform private.log_event(
    'listing.created','listing',listing.id::text,null,to_jsonb(listing)
  );
  return to_jsonb(listing);
end
$$;

create or replace function private.catalog_sync()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_listing_id uuid;
  listing public.listings;
  asset public.collateral_assets;
  auction_row public.auctions;
  catalog_images text[];
begin
  if tg_table_name='listings' then
    v_listing_id=new.id;
  else
    v_listing_id=new.listing_id;
  end if;
  select * into listing from public.listings where id=v_listing_id;
  select * into asset from public.collateral_assets where id=listing.asset_id;
  select * into auction_row from public.auctions where public.auctions.listing_id=v_listing_id;
  if listing.status not in ('live','reserved','sold') then
    delete from public.public_catalog where id=v_listing_id;
    return new;
  end if;
  if not exists(
    select 1 from public.sale_authorizations
    where id=listing.sale_authorization_id and asset_id=listing.asset_id and status='approved'
  ) then
    raise exception 'Approved sale authorization required';
  end if;
  catalog_images=coalesce(nullif(listing.images,'{}'::text[]),
    case when nullif(listing.image,'') is null then '{}'::text[] else array[listing.image] end);

  insert into public.public_catalog(
    id,slug,title,category,method,price,location,condition,image,images,
    ends_at,bids,increment,description,defects,specs,status,created_at
  ) values(
    listing.id,listing.slug,listing.public_title,asset.category,listing.method::text,
    coalesce(auction_row.current_price,auction_row.starting_bid,listing.fixed_price),
    listing.collection_point,listing.condition_grade,coalesce(listing.image,catalog_images[1]),catalog_images,
    auction_row.ends_at,(select count(*) from public.bids where auction_listing_id=v_listing_id),
    coalesce(auction_row.min_increment,0),listing.public_description,listing.defects,
    listing.specs,listing.status::text,listing.created_at
  ) on conflict(id) do update set
    title=excluded.title,method=excluded.method,price=excluded.price,status=excluded.status,
    ends_at=excluded.ends_at,bids=excluded.bids,increment=excluded.increment,
    image=excluded.image,images=excluded.images,description=excluded.description,defects=excluded.defects;
  return new;
end
$$;
create or replace function private.create_listing(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  listing public.listings;
  authorization_row public.sale_authorizations;
  request public.approval_requests;
  config jsonb;
  images text[];
  publish_immediately boolean;
begin
  actor=private.require_staff(2);
  publish_immediately=private.staff_level()>=4;
  select * into authorization_row
  from public.sale_authorizations
  where id=(p_values->>'sale_authorization_id')::uuid
    and asset_id=(p_values->>'asset_id')::uuid;
  if authorization_row.status<>'approved' or authorization_row.id is null then
    raise exception 'Approved sale authorization required';
  end if;

  if jsonb_typeof(p_values->'images')='array' then
    select array_agg(value order by ordinality) into images
    from jsonb_array_elements_text(p_values->'images') with ordinality as photos(value,ordinality);
  end if;
  if coalesce(cardinality(images),0)=0 and nullif(p_values->>'image','') is not null then
    images=array[p_values->>'image'];
  end if;
  if coalesce(cardinality(images),0)>10 then
    raise exception 'A listing can have no more than 10 images';
  end if;

  insert into public.listings(
    asset_id,sale_authorization_id,slug,method,status,public_title,
    public_description,fixed_price,collection_point,terms_version,image,images,
    condition_grade,defects,created_by,approved_by,publish_at
  ) values(
    authorization_row.asset_id,authorization_row.id,p_values->>'slug',
    (p_values->>'method')::public.sale_method,
    case when publish_immediately then 'live'::public.listing_status
      else 'pending_approval'::public.listing_status end,
    p_values->>'title',p_values->>'description',
    case when p_values->>'method'='auction' then null
      else (p_values->>'price')::numeric end,
    p_values->>'collection_point',p_values->>'terms_version',
    coalesce(nullif(p_values->>'image',''),images[1]),coalesce(images,'{}'::text[]),
    coalesce(nullif(p_values->>'condition_grade',''),'Good'),
    p_values->>'defects',actor,
    case when publish_immediately then actor end,
    case when publish_immediately then now() end
  ) returning * into listing;

  if listing.method in ('auction','auction_plus_buy_now') then
    select settings into config
    from public.system_settings
    order by created_at desc
    limit 1;
    insert into public.auctions(
      listing_id,starts_at,ends_at,starting_bid,min_increment,
      extension_window_seconds,extension_seconds,max_extension_count
    ) values(
      listing.id,now(),
      now()+make_interval(hours=>(p_values->>'duration_hours')::integer),
      (p_values->>'price')::numeric,(p_values->>'increment')::numeric,
      (config->>'extension_window')::integer,
      (config->>'extension_seconds')::integer,
      (config->>'max_extensions')::integer
    );
  end if;

  if publish_immediately then
    update public.collateral_assets
    set status='listed'
    where id=listing.asset_id;
    perform private.log_event(
      'listing.published','listing',listing.id::text,null,to_jsonb(listing),
      p_values->>'reason'
    );
  else
    insert into public.approval_requests(
      action_type,entity_type,entity_id,requested_by,required_min_level,
      reason,proposed_values
    ) values(
      'publish_listing','listing',listing.id,actor,3,
      p_values->>'reason',p_values
    ) returning * into request;
  end if;

  perform private.log_event(
    'listing.created','listing',listing.id::text,null,to_jsonb(listing)
  );
  return to_jsonb(listing);
end
$$;

do $$
declare
  migrated_listing record;
begin
  for migrated_listing in
    update public.listings as listing
    set status='live',approved_by=listing.created_by,
      publish_at=coalesce(listing.publish_at,now())
    from public.staff_profiles as staff,public.sale_authorizations as sale_auth
    where listing.status='pending_approval'
      and staff.user_id=listing.created_by
      and staff.security_level=4
      and staff.is_active
      and sale_auth.id=listing.sale_authorization_id
      and sale_auth.asset_id=listing.asset_id
      and sale_auth.status='approved'
    returning listing.id,listing.asset_id,listing.created_by
  loop
    update public.collateral_assets
    set status='listed'
    where id=migrated_listing.asset_id;

    update public.approval_requests
    set status='cancelled',decided_at=now(),
      decision_reason='Automatically published under the Level 4 listing policy migration'
    where action_type='publish_listing'
      and entity_type='listing'
      and entity_id=migrated_listing.id
      and status='pending';

    perform private.log_event(
      'listing.published','listing',migrated_listing.id::text,
      jsonb_build_object('status','pending_approval'),
      jsonb_build_object('status','live','approved_by',migrated_listing.created_by),
      'Automatically published an existing Level 4 listing with approved sale authorization'
    );
  end loop;
end
$$;
create or replace function private.dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  result jsonb;
  chart jsonb;
  attention jsonb;
begin
  perform private.require_staff(1);

  select jsonb_build_object(
    'gross',(select coalesce(sum(amount_due),0) from public.orders where status in ('paid','released','closed','disputed')),
    'recovered',coalesce(sum(amount) filter(where line_type='RECOVERY_TO_LOAN'),0),
    'surplus',coalesce(sum(amount) filter(where line_type='OWNER_SURPLUS'),0),
    'fees',coalesce(sum(amount) filter(where line_type in ('PLATFORM_COMMISSION','OTHER_APPROVED_COST','PAYMENT_FEE','SALE_AGENT_COMMISSION')),0)
  ) into result
  from public.settlement_lines sl
  join public.settlements st on st.id=sl.settlement_id
  where st.status in ('approved','posted_to_loan','closed');

  with months as (
    select generate_series(
      date_trunc('month',now())-interval '5 months',
      date_trunc('month',now()),
      interval '1 month'
    ) as month
  ), sales_by_month as (
    select
      date_trunc('month',created_at) as month,
      sum(amount_due) as gross
    from public.orders
    where status in ('paid','released','closed','disputed')
    group by date_trunc('month',created_at)
  ), settlements_by_month as (
    select
      date_trunc('month',st.created_at) as month,
      coalesce(sum(sl.amount) filter(where sl.line_type='RECOVERY_TO_LOAN'),0) as recovered,
      coalesce(sum(sl.amount) filter(where sl.line_type='OWNER_SURPLUS'),0) as surplus
    from public.settlements st
    join public.settlement_lines sl on sl.settlement_id=st.id
    where st.status in ('approved','posted_to_loan','closed')
    group by date_trunc('month',st.created_at)
  ), monthly_totals as (
    select
      m.month,
      coalesce(sales.gross,0) as gross,
      coalesce(settled.recovered,0) as recovered,
      coalesce(settled.surplus,0) as surplus
    from months m
    left join sales_by_month sales on sales.month=m.month
    left join settlements_by_month settled on settled.month=m.month
  )
  select jsonb_agg(
    jsonb_build_object(
      'month',to_char(month,'Mon'),
      'gross',gross,
      'recovered',recovered,
      'surplus',surplus
    ) order by month
  ) into chart
  from monthly_totals;

  select jsonb_build_object(
    'pending_approvals',(select count(*) from public.approval_requests where status='pending'),
    'awaiting_collection',(select count(*) from public.orders where status='paid'),
    'loan_pending',(select count(*) from public.integration_outbox where status='pending'),
    'loan_dead_letter',(select count(*) from public.integration_outbox where status='dead_letter'),
    'loan_posted',(select count(*) from public.integration_outbox where status='posted')
  ) into attention;

  return jsonb_build_object(
    'kpis',result,
    'chart',coalesce(chart,'[]'::jsonb),
    'attention',attention
  );
end
$$;
alter table public.listings
  alter column sale_authorization_id drop not null;

create or replace function private.create_listing(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  listing public.listings;
  authorization_row public.sale_authorizations;
  request public.approval_requests;
  config jsonb;
  images text[];
  publish_immediately boolean;
begin
  actor=private.require_staff(2);
  publish_immediately=private.staff_level()>=4;

  if nullif(p_values->>'sale_authorization_id','') is not null then
    select * into authorization_row
    from public.sale_authorizations
    where id=(p_values->>'sale_authorization_id')::uuid
      and asset_id=(p_values->>'asset_id')::uuid;
    if authorization_row.id is null or authorization_row.status<>'approved' then
      raise exception 'Approved sale authorization required';
    end if;
  elsif not publish_immediately then
    raise exception 'Approved sale authorization required';
  end if;

  if jsonb_typeof(p_values->'images')='array' then
    select array_agg(value order by ordinality) into images
    from jsonb_array_elements_text(p_values->'images') with ordinality as photos(value,ordinality);
  end if;
  if coalesce(cardinality(images),0)=0 and nullif(p_values->>'image','') is not null then
    images=array[p_values->>'image'];
  end if;
  if coalesce(cardinality(images),0)>10 then
    raise exception 'A listing can have no more than 10 images';
  end if;

  insert into public.listings(
    asset_id,sale_authorization_id,slug,method,status,public_title,
    public_description,fixed_price,collection_point,terms_version,image,images,
    condition_grade,defects,created_by,approved_by,publish_at
  ) values(
    coalesce(authorization_row.asset_id,(p_values->>'asset_id')::uuid),authorization_row.id,p_values->>'slug',
    (p_values->>'method')::public.sale_method,
    case when publish_immediately then 'live'::public.listing_status
      else 'pending_approval'::public.listing_status end,
    p_values->>'title',p_values->>'description',
    case when p_values->>'method'='auction' then null
      else (p_values->>'price')::numeric end,
    p_values->>'collection_point',p_values->>'terms_version',
    coalesce(nullif(p_values->>'image',''),images[1]),coalesce(images,'{}'::text[]),
    coalesce(nullif(p_values->>'condition_grade',''),'Good'),
    p_values->>'defects',actor,
    case when publish_immediately then actor end,
    case when publish_immediately then now() end
  ) returning * into listing;

  if listing.method in ('auction','auction_plus_buy_now') then
    select settings into config
    from public.system_settings
    order by created_at desc
    limit 1;
    insert into public.auctions(
      listing_id,starts_at,ends_at,starting_bid,min_increment,
      extension_window_seconds,extension_seconds,max_extension_count
    ) values(
      listing.id,now(),
      now()+make_interval(hours=>(p_values->>'duration_hours')::integer),
      (p_values->>'price')::numeric,(p_values->>'increment')::numeric,
      (config->>'extension_window')::integer,
      (config->>'extension_seconds')::integer,
      (config->>'max_extensions')::integer
    );
  end if;

  if publish_immediately then
    update public.collateral_assets
    set status='listed'
    where id=listing.asset_id;
    perform private.log_event(
      'listing.published','listing',listing.id::text,null,to_jsonb(listing),
      p_values->>'reason'
    );
  else
    insert into public.approval_requests(
      action_type,entity_type,entity_id,requested_by,required_min_level,
      reason,proposed_values
    ) values(
      'publish_listing','listing',listing.id,actor,3,
      p_values->>'reason',p_values
    ) returning * into request;
  end if;

  perform private.log_event(
    'listing.created','listing',listing.id::text,null,to_jsonb(listing)
  );
  return to_jsonb(listing);
end
$$;

create or replace function private.catalog_sync()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_listing_id uuid;
  listing public.listings;
  asset public.collateral_assets;
  auction_row public.auctions;
  catalog_images text[];
begin
  if tg_table_name='listings' then
    v_listing_id=new.id;
  else
    v_listing_id=new.listing_id;
  end if;
  select * into listing from public.listings where id=v_listing_id;
  select * into asset from public.collateral_assets where id=listing.asset_id;
  select * into auction_row from public.auctions where public.auctions.listing_id=v_listing_id;
  if listing.status not in ('live','reserved','sold') then
    delete from public.public_catalog where id=v_listing_id;
    return new;
  end if;
  if listing.sale_authorization_id is null then
    if listing.approved_by is null or listing.approved_by<>listing.created_by then
      raise exception 'Level 4 direct publication required without sale authorization';
    end if;
  elsif not exists(
    select 1 from public.sale_authorizations
    where id=listing.sale_authorization_id and asset_id=listing.asset_id and status='approved'
  ) then
    raise exception 'Approved sale authorization required';
  end if;
  catalog_images=coalesce(nullif(listing.images,'{}'::text[]),
    case when nullif(listing.image,'') is null then '{}'::text[] else array[listing.image] end);

  insert into public.public_catalog(
    id,slug,title,category,method,price,location,condition,image,images,
    ends_at,bids,increment,description,defects,specs,status,created_at
  ) values(
    listing.id,listing.slug,listing.public_title,asset.category,listing.method::text,
    coalesce(auction_row.current_price,auction_row.starting_bid,listing.fixed_price),
    listing.collection_point,listing.condition_grade,coalesce(listing.image,catalog_images[1]),catalog_images,
    auction_row.ends_at,(select count(*) from public.bids where auction_listing_id=v_listing_id),
    coalesce(auction_row.min_increment,0),listing.public_description,listing.defects,
    listing.specs,listing.status::text,listing.created_at
  ) on conflict(id) do update set
    title=excluded.title,method=excluded.method,price=excluded.price,status=excluded.status,
    ends_at=excluded.ends_at,bids=excluded.bids,increment=excluded.increment,
    image=excluded.image,images=excluded.images,description=excluded.description,defects=excluded.defects;
  return new;
end
$$;
create or replace function private.update_listing(p_listing uuid,p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  listing public.listings;
  auction_row public.auctions;
  old_values jsonb;
  new_images text[];
  new_image text;
  new_price numeric;
begin
  actor=private.require_staff(4);
  select * into listing from public.listings where id=p_listing for update;
  if listing.id is null then
    raise exception 'Listing not found';
  end if;
  if listing.status not in ('live','pending_approval','draft','scheduled') then
    raise exception 'This listing can no longer be edited';
  end if;
  if exists(select 1 from public.orders where listing_id=p_listing and status<>'cancelled') then
    raise exception 'Listings with active or completed orders cannot be edited';
  end if;

  if nullif(btrim(p_values->>'title'),'') is null then
    raise exception 'A public title is required';
  end if;
  if coalesce(nullif(btrim(p_values->>'slug'),''),listing.slug) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Use lowercase letters, numbers, and single hyphens in the listing address';
  end if;

  if p_values ? 'price' then
    new_price=(p_values->>'price')::numeric;
    if new_price is null or new_price<=0 then
      raise exception 'Enter a positive listing price';
    end if;
  end if;
  if listing.method in ('auction','auction_plus_buy_now') then
    select * into auction_row from public.auctions where listing_id=p_listing for update;
    if auction_row.listing_id is null then
      raise exception 'Auction details not found';
    end if;
    if p_values ? 'price' and new_price is distinct from auction_row.starting_bid
       and exists(select 1 from public.bids where auction_listing_id=p_listing) then
      raise exception 'Auction prices cannot be changed after bidding starts';
    end if;
  end if;

  if jsonb_typeof(p_values->'images')='array' then
    select array_agg(value order by ordinality) into new_images
    from jsonb_array_elements_text(p_values->'images') with ordinality as photos(value,ordinality);
    if coalesce(cardinality(new_images),0)>10 then
      raise exception 'A listing can have no more than 10 images';
    end if;
  else
    new_images=listing.images;
  end if;
  new_image=case
    when p_values ? 'image' then coalesce(nullif(p_values->>'image',''),new_images[1])
    when jsonb_typeof(p_values->'images')='array' then new_images[1]
    else listing.image
  end;

  old_values=to_jsonb(listing);
  update public.listings set
    slug=coalesce(nullif(btrim(p_values->>'slug'),''),listing.slug),
    public_title=btrim(p_values->>'title'),
    public_description=case when p_values ? 'description' then nullif(btrim(p_values->>'description'),'') else listing.public_description end,
    fixed_price=case
      when listing.method='auction' then listing.fixed_price
      when p_values ? 'price' then new_price
      else listing.fixed_price
    end,
    collection_point=coalesce(nullif(btrim(p_values->>'collection_point'),''),listing.collection_point),
    condition_grade=coalesce(nullif(p_values->>'condition_grade',''),listing.condition_grade),
    defects=case when p_values ? 'defects' then p_values->>'defects' else listing.defects end,
    image=new_image,
    images=new_images
  where id=p_listing returning * into listing;

  if listing.method in ('auction','auction_plus_buy_now') and p_values ? 'price'
     and new_price is distinct from auction_row.starting_bid then
    update public.auctions set starting_bid=new_price where listing_id=p_listing;
  end if;
  if listing.status in ('live','reserved','sold') then
    update public.public_catalog
    set slug=listing.slug,location=listing.collection_point,condition=listing.condition_grade
    where id=p_listing;
  end if;

  perform private.log_event(
    'listing.updated','listing',p_listing::text,old_values,to_jsonb(listing),
    coalesce(nullif(btrim(p_values->>'reason'),''),'Level 4 updated listing details')
  );
  return to_jsonb(listing);
end
$$;

create or replace function private.archive_listings(p_listings uuid[])
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  selected_listing_id uuid;
  listing public.listings;
  old_values jsonb;
  archived_count integer:=0;
begin
  actor=private.require_staff(4);
  if p_listings is null or cardinality(p_listings)<1 or cardinality(p_listings)>50 then
    raise exception 'Select between 1 and 50 listings';
  end if;
  if cardinality(p_listings)<>(select count(distinct selected.id)::integer from unnest(p_listings) as selected(id)) then
    raise exception 'The listing selection contains duplicates';
  end if;

  foreach selected_listing_id in array p_listings loop
    select * into listing from public.listings where id=selected_listing_id for update;
    if listing.id is null then
      raise exception 'A selected listing was not found';
    end if;
    if listing.status in ('sold','reserved') then
      raise exception 'Sold or reserved listings cannot be archived';
    end if;
    if exists(select 1 from public.orders where listing_id=listing.id and status<>'cancelled') then
      raise exception 'Listings with active or completed orders cannot be archived';
    end if;
    if exists(select 1 from public.bids where auction_listing_id=listing.id) then
      raise exception 'Listings with bid history cannot be archived';
    end if;

    old_values=to_jsonb(listing);
    update public.listings set status='archived' where id=listing.id returning * into listing;
    update public.approval_requests
    set status='cancelled',decided_at=now(),decision_reason='Listing archived by Level 4 staff'
    where action_type='publish_listing' and entity_type='listing'
      and entity_id=listing.id and status='pending';
    update public.collateral_assets asset
    set status=case when exists(
      select 1 from public.sale_authorizations sale_auth
      where sale_auth.asset_id=asset.id and sale_auth.status='approved'
    ) then 'approved_for_sale'::public.asset_status else 'held'::public.asset_status end
    where asset.id=listing.asset_id and asset.status='listed'
      and not exists(
        select 1 from public.listings active_listing
        where active_listing.asset_id=asset.id
          and active_listing.status in ('scheduled','live','reserved')
      );
    perform private.log_event(
      'listing.archived','listing',listing.id::text,old_values,to_jsonb(listing),
      'Listing removed from the public website by Level 4 staff'
    );
    archived_count=archived_count+1;
  end loop;
  return jsonb_build_object('archived_count',archived_count);
end
$$;

create or replace function public.update_listing(p_listing uuid,p_values jsonb)
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.update_listing(p_listing,p_values)$$;

create or replace function public.archive_listings(p_listings uuid[])
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.archive_listings(p_listings)$$;

grant execute on function private.update_listing(uuid,jsonb),private.archive_listings(uuid[]) to authenticated;
grant execute on function public.update_listing(uuid,jsonb),public.archive_listings(uuid[]) to authenticated;
create or replace function private.apply_high_value_release_policy()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  release_amount numeric;
  release_threshold numeric;
begin
  if new.action_type<>'release' then
    return new;
  end if;

  select amount_due into release_amount
  from public.orders
  where id=new.entity_id;

  select coalesce((settings->>'high_value_threshold')::numeric,5000000)
  into release_threshold
  from public.system_settings
  order by created_at desc
  limit 1;

  if release_amount is not null and release_threshold is not null
     and release_amount>=release_threshold then
    new.required_min_level=4;
  end if;
  return new;
end
$$;

drop trigger if exists high_value_release_policy on public.approval_requests;
create trigger high_value_release_policy
before insert on public.approval_requests
for each row execute function private.apply_high_value_release_policy();
create or replace function public.admin_release_history()
returns table(
  order_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_contact text,
  collector_name text,
  collector_ref text,
  handover_staff text,
  release_status text,
  released_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform private.require_staff(2);
  return query
  select
    orders.id,
    coalesce(
      nullif(btrim(orders.buyer_name),''),
      nullif(btrim(profiles.display_name),''),
      nullif(btrim(buyers.email),''),
      'Unknown buyer'
    ),
    buyers.email::text,
    orders.buyer_contact,
    releases.collector_name,
    releases.collector_ref,
    collector_staff.full_name,
    coalesce(releases.status,'not_requested'),
    releases.released_at
  from public.orders orders
  left join public.profiles profiles on profiles.user_id=orders.buyer_id
  left join auth.users buyers on buyers.id=orders.buyer_id
  left join public.release_orders releases on releases.order_id=orders.id
  left join public.staff_profiles collector_staff on collector_staff.user_id=releases.released_by
  where orders.status in ('paid','released')
  order by coalesce(releases.released_at,orders.paid_at,orders.created_at) desc;
end
$$;

revoke all on function public.admin_release_history() from public,anon;
grant execute on function public.admin_release_history() to authenticated;
$cmrp_schema$;
  create table public.cmrp_installation(version text primary key,installed_at timestamptz not null default now());
  alter table public.cmrp_installation enable row level security;
  revoke all on public.cmrp_installation from public,anon,authenticated;
  insert into public.cmrp_installation(version) values('20261009300000_release_buyer_handover_reporting.sql');
end
$cmrp_installer$;
notify pgrst, 'reload schema';
commit;
