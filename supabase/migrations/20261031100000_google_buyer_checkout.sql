alter table public.support_conversations
  add column if not exists customer_user_id uuid
  references auth.users(id) on delete set null;

create index if not exists support_conversations_customer_latest_idx
  on public.support_conversations(customer_user_id,last_message_at desc);

create or replace function private.require_buyer()
returns uuid
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null
     or not exists(
       select 1
       from auth.users
       where id=auth.uid()
         and (email_confirmed_at is not null or phone_confirmed_at is not null)
         and coalesce(is_anonymous,false)=false
     ) then
    raise exception 'Verified buyer account required';
  end if;
  if coalesce(auth.jwt()->'app_metadata'->>'provider','')<>'google'
     and not coalesce((auth.jwt()->'app_metadata'->'providers') ? 'google',false) then
    raise exception 'Google sign-in is required for buyer features';
  end if;
  return auth.uid();
end
$$;

create or replace function private.support_start(
  p_token uuid,
  p_name text,
  p_email text,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid=auth.uid();
  customer public.support_conversations;
  customer_email text;
  customer_name text;
  clean_body text=btrim(p_body);
begin
  if actor is null then raise exception 'Sign in with Google to message support'; end if;
  if coalesce(auth.jwt()->'app_metadata'->>'provider','')<>'google'
     and not coalesce((auth.jwt()->'app_metadata'->'providers') ? 'google',false) then
    raise exception 'Google sign-in is required to message support';
  end if;
  if p_token is null or length(clean_body) not between 1 and 2000 then
    raise exception 'Enter a message';
  end if;
  select u.email,
    coalesce(
      nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
      nullif(btrim(u.raw_user_meta_data->>'name'),''),
      nullif(btrim(u.raw_user_meta_data->>'display_name'),''),
      u.email
    )
  into customer_email,customer_name
  from auth.users u
  where u.id=actor and u.email_confirmed_at is not null;
  if customer_email is null then
    raise exception 'A verified Google email is required to message support';
  end if;
  perform private.consume_rate(actor::text,'support_start',4);
  insert into public.support_conversations(
    customer_name,customer_email,token_hash,customer_user_id
  )
  values(
    customer_name,lower(customer_email),md5(p_token::text),actor
  )
  returning * into customer;
  insert into public.support_messages(conversation_id,sender,body)
  values(customer.id,'customer',clean_body);
  return jsonb_build_object('conversation_id',customer.id);
end
$$;

create or replace function private.support_customer_reply(
  p_token uuid,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid=auth.uid();
  conversation public.support_conversations;
  clean_body text=btrim(p_body);
begin
  if actor is null then raise exception 'Sign in with Google to continue'; end if;
  if coalesce(auth.jwt()->'app_metadata'->>'provider','')<>'google'
     and not coalesce((auth.jwt()->'app_metadata'->'providers') ? 'google',false) then
    raise exception 'Google sign-in is required to message support';
  end if;
  if p_token is null or length(clean_body) not between 1 and 2000 then
    raise exception 'Enter a message';
  end if;
  perform private.consume_rate(actor::text,'support_reply',10);
  select * into conversation
  from public.support_conversations
  where token_hash=md5(p_token::text)
    and customer_user_id=actor
  for update;
  if conversation.id is null then raise exception 'Conversation not found'; end if;
  insert into public.support_messages(conversation_id,sender,body)
  values(conversation.id,'customer',clean_body);
  update public.support_conversations
  set status='open',last_message_at=now()
  where id=conversation.id;
  return jsonb_build_object('sent',true);
end
$$;

create or replace function private.support_read(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid=auth.uid();
  v_conversation_id uuid;
begin
  if actor is null then raise exception 'Sign in with Google to view support messages'; end if;
  if coalesce(auth.jwt()->'app_metadata'->>'provider','')<>'google'
     and not coalesce((auth.jwt()->'app_metadata'->'providers') ? 'google',false) then
    raise exception 'Google sign-in is required to view support messages';
  end if;
  if p_token is null then raise exception 'Conversation not found'; end if;
  select c.id into v_conversation_id
  from public.support_conversations c
  where c.token_hash=md5(p_token::text)
    and c.customer_user_id=actor;
  if v_conversation_id is null then raise exception 'Conversation not found'; end if;
  return jsonb_build_object(
    'messages',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'sender',m.sender,'body',m.body,'created_at',m.created_at
      ) order by m.created_at,m.id)
      from public.support_messages m
      where m.conversation_id=v_conversation_id
    ),'[]'::jsonb)
  );
end
$$;

notify pgrst,'reload schema';
