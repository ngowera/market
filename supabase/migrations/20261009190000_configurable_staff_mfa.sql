-- Preserve MFA enforcement for configured staff while allowing documented exceptions.
update public.staff_profiles
set mfa_required=true
where security_level>=3 and not mfa_required;

create or replace function private.staff_level()
returns smallint
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select security_level
    from public.staff_profiles
    where user_id=auth.uid()
      and is_active
      and (not mfa_required or (auth.jwt()->>'aal')='aal2')
  ),0)::smallint
$$;