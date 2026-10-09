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
