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