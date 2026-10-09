create or replace function private.request_change(p_action text,p_entity uuid,p_values jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  request public.approval_requests;
  required_level integer;
  listing public.listings;
  auction_row public.auctions;
  values_to_save jsonb:=p_values;
  requested_price numeric;
  current_price numeric;
begin
  required_level=case when p_action in ('staff_change','settings_change','fee_change') then 4 else 3 end;
  actor=private.require_staff(case when p_action in ('release','settlement','listing_price_change') then 2 else required_level end);
  if p_action not in ('staff_change','settings_change','fee_change','settlement','release','listing_price_change') then
    raise exception 'Unsupported change';
  end if;
  if p_action='release' and not exists(select 1 from public.orders where id=p_entity and status='paid') then
    raise exception 'Verified paid payment required';
  end if;
  if p_action='settlement' and not exists(select 1 from public.settlements where id=p_entity and status='draft') then
    raise exception 'Draft settlement required';
  end if;

  if p_action='listing_price_change' then
    requested_price=(p_values->>'price')::numeric;
    if requested_price is null or requested_price<=0
       or requested_price<>round(requested_price,2)
       or coalesce(length(trim(p_values->>'reason')),0)<3 then
      raise exception 'A valid positive price and reason are required';
    end if;
    select * into listing from public.listings where id=p_entity for update;
    if listing.id is null or listing.status<>'live' then
      raise exception 'Only live listings can be repriced';
    end if;
    if exists(select 1 from public.approval_requests where action_type='listing_price_change' and entity_id=p_entity and status='pending') then
      raise exception 'A price change is already awaiting approval';
    end if;
    if exists(select 1 from public.orders where listing_id=listing.id and status in ('awaiting_payment','paid','released','closed','disputed')) then
      raise exception 'Price is locked after a purchase starts';
    end if;
    if listing.method in ('auction','auction_plus_buy_now') then
      select * into auction_row from public.auctions where listing_id=listing.id for update;
      if auction_row.listing_id is null or exists(select 1 from public.bids where auction_listing_id=listing.id) then
        raise exception 'Starting bid is locked after bidding starts';
      end if;
      current_price=coalesce(auction_row.current_price,auction_row.starting_bid);
    else
      current_price=listing.fixed_price;
    end if;
    if current_price is null or requested_price=current_price then
      raise exception 'Enter a different valid price';
    end if;
    values_to_save=p_values||jsonb_build_object(
      'title',listing.public_title,
      'method',listing.method::text,
      'old_price',current_price
    );
  end if;

  insert into public.approval_requests(
    action_type,entity_type,entity_id,requested_by,required_min_level,
    reason,proposed_values
  ) values(
    p_action,
    case when p_action='listing_price_change' then 'listing' else p_action end,
    p_entity,actor,required_level,
    coalesce(p_values->>'reason','Operational review requested'),values_to_save
  ) returning * into request;
  perform private.log_event('approval.requested',request.entity_type,p_entity::text,null,to_jsonb(request));
  return to_jsonb(request);
end
$$;

create or replace function private.approve_action(p_request uuid,p_decision text,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  request public.approval_requests;
  proposal jsonb;
  settlement public.settlements;
  order_row public.orders;
  listing_row public.listings;
  auction_row public.auctions;
  authorization_row public.sale_authorizations;
  total numeric;
  token text;
  cash_release_code text;
begin
  actor=private.require_staff(3);
  select * into request from public.approval_requests where id=p_request for update;
  if request.id is null or request.status<>'pending' or request.requested_by=actor
     or private.staff_level()<request.required_min_level
     or p_decision not in ('approved','rejected') or length(trim(p_reason))<3 then
    raise exception 'Independent eligible approver and reason required';
  end if;
  proposal=request.proposed_values;

  if p_decision='approved' then
    case request.action_type
      when 'sale_authorization' then
        select * into authorization_row from public.sale_authorizations where id=request.entity_id for update;
        update public.sale_authorizations set status='approved',decided_by=actor,decided_at=now(),decision_reason=p_reason where id=request.entity_id;
        update public.collateral_assets set status='approved_for_sale' where id=authorization_row.asset_id;
      when 'publish_listing' then
        if not exists(select 1 from public.listings l join public.sale_authorizations a on a.id=l.sale_authorization_id and a.asset_id=l.asset_id where l.id=request.entity_id and l.status='pending_approval' and a.status='approved') then
          raise exception 'Sale authorization required';
        end if;
        update public.listings set status='live',approved_by=actor,publish_at=now() where id=request.entity_id;
        update public.collateral_assets set status='listed' where id=(select asset_id from public.listings where id=request.entity_id);
      when 'listing_price_change' then
        select * into listing_row from public.listings where id=request.entity_id for update;
        if listing_row.id is null or listing_row.status<>'live'
           or listing_row.method::text<>proposal->>'method' then
          raise exception 'Listing changed or is no longer live';
        end if;
        if exists(select 1 from public.orders where listing_id=listing_row.id and status in ('awaiting_payment','paid','released','closed','disputed')) then
          raise exception 'Price is locked after a purchase starts';
        end if;
        if listing_row.method in ('auction','auction_plus_buy_now') then
          select * into auction_row from public.auctions where listing_id=listing_row.id for update;
          if auction_row.listing_id is null or exists(select 1 from public.bids where auction_listing_id=listing_row.id) then
            raise exception 'Starting bid is locked after bidding starts';
          end if;
          if coalesce(auction_row.current_price,auction_row.starting_bid)<>(proposal->>'old_price')::numeric then
            raise exception 'Listing price changed since this request was submitted';
          end if;
          update public.auctions set starting_bid=(proposal->>'price')::numeric where listing_id=listing_row.id;
          if listing_row.method='auction_plus_buy_now' then
            update public.listings set fixed_price=(proposal->>'price')::numeric where id=listing_row.id;
          end if;
        else
          if listing_row.fixed_price is null or listing_row.fixed_price<>(proposal->>'old_price')::numeric then
            raise exception 'Listing price changed since this request was submitted';
          end if;
          update public.listings set fixed_price=(proposal->>'price')::numeric where id=listing_row.id;
        end if;
      when 'staff_change' then
        insert into public.staff_profiles(user_id,full_name,security_level,is_active,mfa_required,created_by)
        values((proposal->>'user_id')::uuid,proposal->>'full_name',(proposal->>'security_level')::smallint,(proposal->>'is_active')::boolean,(proposal->>'security_level')::integer>=3,actor)
        on conflict(user_id) do update set full_name=excluded.full_name,security_level=excluded.security_level,is_active=excluded.is_active,mfa_required=excluded.mfa_required;
      when 'settings_change' then
        insert into public.system_settings(settings,approved_by) values(proposal,actor);
      when 'fee_change' then
        insert into public.fee_rules(version,platform_bps,fixed_fee,effective_at,approved_by,is_active)
        values(proposal->>'version',(proposal->>'platform_bps')::integer,(proposal->>'fixed_fee')::numeric,(proposal->>'effective_at')::timestamptz,actor,true);
      when 'settlement' then
        select * into settlement from public.settlements where id=request.entity_id for update;
        if settlement.status<>'draft' or not exists(select 1 from public.orders where id=settlement.order_id and status in ('paid','released')) then
          raise exception 'Paid draft settlement required';
        end if;
        select sum(direction*amount) into total from public.settlement_lines where settlement_id=settlement.id and line_type<>'SHORTFALL';
        if total<>0 or total is null then raise exception 'Settlement does not balance'; end if;
        update public.settlements set status='approved',approved_by=actor,approved_at=now() where id=settlement.id;
        insert into public.integration_outbox(settlement_id,payload)
        select settlement.id,jsonb_build_object(
          'external_loan_id',bridge.external_loan_id,
          'marketplace_order_no',order_record.order_no,
          'gross_sale',settlement.gross_sale,
          'currency',settlement.currency,
          'loan_recovery',(select amount from public.settlement_lines where settlement_id=settlement.id and line_type='RECOVERY_TO_LOAN'),
          'surplus',(select amount from public.settlement_lines where settlement_id=settlement.id and line_type='OWNER_SURPLUS'),
          'settled_at',now()
        )
        from public.orders order_record
        join public.listings sale_listing on sale_listing.id=order_record.listing_id
        join public.collateral_assets asset on asset.id=sale_listing.asset_id
        join public.loans_bridge bridge on bridge.id=asset.loan_bridge_id
        where order_record.id=settlement.order_id
        on conflict(settlement_id) do nothing;
      when 'release' then
        select * into order_row from public.orders where id=request.entity_id for update;
        if order_row.status<>'paid' then raise exception 'Verified payment required'; end if;
        token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
        insert into public.release_orders(order_id,release_token_hash,status,approved_by,approved_at,prepared_by,collector_name,collector_ref)
        values(order_row.id,encode(sha256(convert_to(token,'UTF8')),'hex'),'approved',actor,now(),request.requested_by,proposal->>'collector_name',proposal->>'collector_ref');
        if order_row.buyer_id is not null then
          insert into public.notifications(user_id,kind,message,entity_id)
          values(order_row.buyer_id,'collection_ready','Your collection code: '||token,order_row.id);
        else
          cash_release_code=token;
        end if;
      else
        raise exception 'Unsupported approval action';
    end case;
  end if;

  update public.approval_requests set status=p_decision::public.approval_status,decided_by=actor,decided_at=now(),decision_reason=p_reason where id=request.id;
  perform private.log_event('approval.'||p_decision,request.entity_type,request.entity_id::text,to_jsonb(request),jsonb_build_object('decision',p_decision),p_reason);
  return jsonb_build_object('status',p_decision,'release_code',cash_release_code);
end
$$;