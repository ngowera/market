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