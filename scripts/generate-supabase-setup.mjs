import fs from 'node:fs/promises';
const migration='20261005182742_cmrp_foundation.sql';
const upgrade='20261009120000_standalone_inventory.sql';
const storageUpgrade='20261009163000_listing_photo_storage.sql';
const installerVersion=storageUpgrade;
const sql=await fs.readFile('supabase/migrations/'+migration,'utf8');
const upgradeSql=await fs.readFile('supabase/migrations/'+upgrade,'utf8');
const storageUpgradeSql=await fs.readFile('supabase/migrations/'+storageUpgrade,'utf8');
const tables=[...sql.matchAll(/create table public\.(\w+)/g)].map(m=>m[1]);
const types=[...sql.matchAll(/create type public\.(\w+)/g)].map(m=>m[1]);
const output=`-- CMRP: paste this entire file into Supabase SQL Editor and Run as postgres.
-- Installs tables, functions, RLS, public catalogue, storage and realtime.
-- Does not create sample listings, change passwords or delete existing data.
-- Rerunning this installer is safe. Existing conflicting objects stop installation.
begin;
do $cmrp_installer$
declare conflict_name text;
begin
  perform pg_advisory_xact_lock(20261005,182742);
  if to_regclass('public.cmrp_installation') is not null then
    if exists(select 1 from public.cmrp_installation where version='${installerVersion}') then
      raise notice 'CMRP already installed; no changes made'; return;
    end if;
    raise exception 'Different CMRP version installed. Use migrations instead.';
  end if;
  select name into conflict_name from unnest(array[${tables.map(n=>"'"+n+"'").join(',')}]) name
    where to_regclass('public.'||name) is not null limit 1;
  if conflict_name is not null then raise exception 'Existing public.% conflicts with CMRP. No changes made; use a separate Supabase project or review the schema.',conflict_name; end if;
  select name into conflict_name from unnest(array[${types.map(n=>"'"+n+"'").join(',')}]) name
    where to_regtype('public.'||name) is not null limit 1;
  if conflict_name is not null then raise exception 'Existing type public.% conflicts with CMRP. No changes made.',conflict_name; end if;
  if exists(select 1 from pg_namespace where nspname='private') then
    raise exception 'Existing private schema requires manual review. No changes made.';
  end if;
  execute $cmrp_schema$
${sql}
${upgradeSql}
${storageUpgradeSql}
$cmrp_schema$;
  create table public.cmrp_installation(version text primary key,installed_at timestamptz not null default now());
  alter table public.cmrp_installation enable row level security;
  revoke all on public.cmrp_installation from public,anon,authenticated;
  insert into public.cmrp_installation(version) values('${installerVersion}');
end
$cmrp_installer$;
notify pgrst, 'reload schema';
commit;
`;
await fs.writeFile('supabase/setup.sql',output);
