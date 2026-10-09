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