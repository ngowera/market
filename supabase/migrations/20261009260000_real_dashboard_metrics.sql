create or replace function private.dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  result jsonb;
  chart jsonb;
  attention jsonb;
begin
  perform private.require_staff(1);

  select jsonb_build_object(
    'gross',(select coalesce(sum(amount_due),0) from public.orders where status in ('paid','released','closed','disputed')),
    'recovered',coalesce(sum(amount) filter(where line_type='RECOVERY_TO_LOAN'),0),
    'surplus',coalesce(sum(amount) filter(where line_type='OWNER_SURPLUS'),0),
    'fees',coalesce(sum(amount) filter(where line_type in ('PLATFORM_COMMISSION','OTHER_APPROVED_COST','PAYMENT_FEE','SALE_AGENT_COMMISSION')),0)
  ) into result
  from public.settlement_lines sl
  join public.settlements st on st.id=sl.settlement_id
  where st.status in ('approved','posted_to_loan','closed');

  with months as (
    select generate_series(
      date_trunc('month',now())-interval '5 months',
      date_trunc('month',now()),
      interval '1 month'
    ) as month
  ), sales_by_month as (
    select
      date_trunc('month',created_at) as month,
      sum(amount_due) as gross
    from public.orders
    where status in ('paid','released','closed','disputed')
    group by date_trunc('month',created_at)
  ), settlements_by_month as (
    select
      date_trunc('month',st.created_at) as month,
      coalesce(sum(sl.amount) filter(where sl.line_type='RECOVERY_TO_LOAN'),0) as recovered,
      coalesce(sum(sl.amount) filter(where sl.line_type='OWNER_SURPLUS'),0) as surplus
    from public.settlements st
    join public.settlement_lines sl on sl.settlement_id=st.id
    where st.status in ('approved','posted_to_loan','closed')
    group by date_trunc('month',st.created_at)
  ), monthly_totals as (
    select
      m.month,
      coalesce(sales.gross,0) as gross,
      coalesce(settled.recovered,0) as recovered,
      coalesce(settled.surplus,0) as surplus
    from months m
    left join sales_by_month sales on sales.month=m.month
    left join settlements_by_month settled on settled.month=m.month
  )
  select jsonb_agg(
    jsonb_build_object(
      'month',to_char(month,'Mon'),
      'gross',gross,
      'recovered',recovered,
      'surplus',surplus
    ) order by month
  ) into chart
  from monthly_totals;

  select jsonb_build_object(
    'pending_approvals',(select count(*) from public.approval_requests where status='pending'),
    'awaiting_collection',(select count(*) from public.orders where status='paid'),
    'loan_pending',(select count(*) from public.integration_outbox where status='pending'),
    'loan_dead_letter',(select count(*) from public.integration_outbox where status='dead_letter'),
    'loan_posted',(select count(*) from public.integration_outbox where status='posted')
  ) into attention;

  return jsonb_build_object(
    'kpis',result,
    'chart',coalesce(chart,'[]'::jsonb),
    'attention',attention
  );
end
$$;