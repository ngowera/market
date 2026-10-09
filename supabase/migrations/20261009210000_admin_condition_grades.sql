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