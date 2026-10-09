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