create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  token_hash text not null unique,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('customer','admin')),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_time_idx
  on public.support_messages(conversation_id, created_at, id);
create index if not exists support_conversations_latest_idx
  on public.support_conversations(last_message_at desc);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_conversations, public.support_messages from public, anon, authenticated;

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
  v_conversation_id uuid;
  clean_name text=btrim(p_name);
  clean_email text=lower(btrim(p_email));
  clean_body text=btrim(p_body);
begin
  if p_token is null or length(clean_name) not between 2 and 120
     or length(clean_email) not between 3 and 254
     or position('@' in clean_email)<2 or length(clean_body) not between 1 and 2000 then
    raise exception 'Enter your name, a valid email address, and a message';
  end if;
  perform private.consume_rate(clean_email,'support_start',4);
  insert into public.support_conversations(customer_name,customer_email,token_hash)
  values(clean_name,clean_email,md5(p_token::text))
  returning id into v_conversation_id;
  insert into public.support_messages(conversation_id,sender,body)
  values(v_conversation_id,'customer',clean_body);
  return jsonb_build_object('conversation_id',v_conversation_id);
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
  conversation public.support_conversations;
  clean_body text=btrim(p_body);
begin
  if p_token is null or length(clean_body) not between 1 and 2000 then
    raise exception 'Enter a message';
  end if;
  perform private.consume_rate(md5(p_token::text),'support_reply',10);
  select * into conversation
  from public.support_conversations
  where token_hash=md5(p_token::text)
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
declare v_conversation_id uuid;
begin
  if p_token is null then raise exception 'Conversation not found'; end if;
  select c.id into v_conversation_id
  from public.support_conversations c
  where c.token_hash=md5(p_token::text);
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

create or replace function private.support_admin_conversations()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.require_staff(1);
  return coalesce((
    select jsonb_agg(to_jsonb(items) order by items.last_message_at desc)
    from (
      select c.id,c.customer_name,c.customer_email,c.status,c.created_at,c.last_message_at,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',m.id,'sender',m.sender,'body',m.body,'created_at',m.created_at
          ) order by m.created_at,m.id)
          from (
            select sm.id,sm.sender,sm.body,sm.created_at
            from public.support_messages sm
            where sm.conversation_id=c.id
            order by sm.created_at desc,sm.id desc
            limit 100
          ) m
        ),'[]'::jsonb) as messages
      from public.support_conversations c
      order by c.last_message_at desc
      limit 100
    ) items
  ),'[]'::jsonb);
end
$$;

create or replace function private.support_admin_reply(
  p_conversation uuid,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  clean_body text=btrim(p_body);
begin
  perform private.require_staff(1);
  if p_conversation is null or length(clean_body) not between 1 and 2000 then
    raise exception 'Enter a message';
  end if;
  perform 1 from public.support_conversations where id=p_conversation for update;
  if not found then raise exception 'Conversation not found'; end if;
  insert into public.support_messages(conversation_id,sender,body)
  values(p_conversation,'admin',clean_body);
  update public.support_conversations
  set status='open',last_message_at=now()
  where id=p_conversation;
  perform private.log_event(
    'support.replied','support_conversation',p_conversation::text,null,
    jsonb_build_object('message_length',length(clean_body)),
    'Staff replied to a customer support conversation'
  );
  return jsonb_build_object('sent',true);
end
$$;

create or replace function public.support_start(p_token uuid,p_name text,p_email text,p_body text)
returns jsonb language sql security definer set search_path=''
as $$select private.support_start(p_token,p_name,p_email,p_body)$$;
create or replace function public.support_customer_reply(p_token uuid,p_body text)
returns jsonb language sql security definer set search_path=''
as $$select private.support_customer_reply(p_token,p_body)$$;
create or replace function public.support_read(p_token uuid)
returns jsonb language sql security definer set search_path=''
as $$select private.support_read(p_token)$$;
create or replace function public.support_admin_conversations()
returns jsonb language sql security definer set search_path=''
as $$select private.support_admin_conversations()$$;
create or replace function public.support_admin_reply(p_conversation uuid,p_body text)
returns jsonb language sql security definer set search_path=''
as $$select private.support_admin_reply(p_conversation,p_body)$$;

revoke all on function public.support_start(uuid,text,text,text),
  public.support_customer_reply(uuid,text),public.support_read(uuid),
  public.support_admin_conversations(),public.support_admin_reply(uuid,text) from public;
grant execute on function public.support_start(uuid,text,text,text),
  public.support_customer_reply(uuid,text),public.support_read(uuid) to anon,authenticated;
grant execute on function public.support_admin_conversations(),
  public.support_admin_reply(uuid,text) to authenticated;

notify pgrst,'reload schema';
