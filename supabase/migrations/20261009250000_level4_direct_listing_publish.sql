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