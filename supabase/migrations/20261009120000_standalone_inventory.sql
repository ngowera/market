-- Allow standalone collateral and settle proceeds without loan recovery.
create or replace function private.create_asset(p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  loan uuid;
  a public.collateral_assets;
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
    loan_bridge_id,asset_ref,title,category,valuation_amount,
    custody_location,condition_notes,created_by
  ) values(
    loan,p_values->>'asset_ref',p_values->>'title',p_values->>'category',
    (p_values->>'valuation_amount')::numeric,p_values->>'custody_location',
    p_values->>'condition_notes',actor
  ) returning * into a;
  perform private.log_event(
    'asset.created','asset',a.id::text,null,to_jsonb(a),p_values->>'reason'
  );
  return to_jsonb(a);
end
$$;

create or replace function private.confirm_verified_payment(
  p_tx_ref text,
  p_amount numeric,
  p_currency text,
  p_provider_ref text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.payments;
  o public.orders;
  s public.settlements;
  rule public.fee_rules;
  outstanding numeric;
  linked_loan uuid;
  fees numeric;
  pool numeric;
  recovery numeric;
  surplus numeric;
  shortfall numeric;
begin
  perform private.require_service();
  select * into p from public.payments where tx_ref=p_tx_ref for update;
  if p.id is null then raise exception 'Unknown payment'; end if;
  select * into o from public.orders where id=p.order_id for update;
  if p.amount<>p_amount or o.amount_due<>p_amount or p.currency<>p_currency or o.currency<>p_currency then
    raise exception 'Payment amount or currency mismatch';
  end if;
  if p.status='paid' then return jsonb_build_object('status','paid','id',p.id); end if;
  if o.status<>'awaiting_payment' then
    raise exception 'Late or unavailable order payment needs finance review';
  end if;

  select a.loan_bridge_id,coalesce(b.outstanding_amount,0)
  into linked_loan,outstanding
  from public.listings l
  join public.collateral_assets a on a.id=l.asset_id
  left join public.loans_bridge b on b.id=a.loan_bridge_id
  where l.id=o.listing_id;
  if not found then raise exception 'Listing collateral not found'; end if;

  update public.payments
  set status='paid',verified_at=now(),provider_transaction_id=p_provider_ref,
      verification_payload=p_payload
  where id=p.id;
  update public.orders set status='paid',paid_at=now() where id=o.id;
  update public.listings set status='sold' where id=o.listing_id;
  update public.collateral_assets set status='sold'
  where id=(select asset_id from public.listings where id=o.listing_id);

  select * into rule from public.fee_rules
  where is_active and effective_at<=now()
  order by effective_at desc limit 1;
  if rule.version is null then raise exception 'Approved fee rule required'; end if;
  fees=round(p_amount*rule.platform_bps/10000,2)+rule.fixed_fee;
  if fees>p_amount then raise exception 'Fees exceed sale'; end if;
  pool=p_amount-fees;
  recovery=least(pool,outstanding);
  surplus=greatest(pool-outstanding,0);
  shortfall=greatest(outstanding-pool,0);

  insert into public.settlements(
    order_id,gross_sale,rule_version,created_by,loan_sync
  ) values(
    o.id,p_amount,rule.version,o.buyer_id,
    case when linked_loan is null then 'not_applicable' else 'pending' end
  ) returning * into s;
  insert into public.settlement_lines(settlement_id,line_type,direction,amount)
  values
    (s.id,'GROSS_SALE',1,p_amount),
    (s.id,'PLATFORM_COMMISSION',-1,round(p_amount*rule.platform_bps/10000,2)),
    (s.id,'OTHER_APPROVED_COST',-1,rule.fixed_fee),
    (s.id,'RECOVERY_TO_LOAN',-1,recovery),
    (s.id,'OWNER_SURPLUS',-1,surplus),
    (s.id,'SHORTFALL',1,shortfall);
  insert into public.notifications(user_id,kind,message,entity_id)
  values(o.buyer_id,'payment_verified',
    'Payment verified. Awaiting staff collection approval.',o.id);
  perform private.log_event('payment.verified','payment',p.id::text,null,p_payload);
  return jsonb_build_object('status','paid','id',p.id,'settlement_id',s.id);
end
$$;