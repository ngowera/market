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