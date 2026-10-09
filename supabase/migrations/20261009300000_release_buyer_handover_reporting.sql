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
    buyers.email,
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