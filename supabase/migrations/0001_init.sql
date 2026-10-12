-- Tarteeb MVP schema. Run in the Supabase SQL editor.
-- Covers: profiles, clients, conversations, messages, proposals, orders,
-- order_tasks, order_activity, ai_settings + RLS + confirm_intake RPC.

-- ============ tables ============

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  timezone text not null default 'UTC',
  default_currency char(3) not null default 'EGP',
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists clients_user_name_idx on clients (user_id, lower(name));

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New intake',
  status text not null default 'open' check (status in ('open','confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_updated_idx on conversations (user_id, updated_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null check (char_length(content) <= 12000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_created_idx on messages (conversation_id, created_at);

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft','ready','confirmed','superseded')),
  idempotency_key uuid not null default gen_random_uuid(),
  assistant_label text not null default 'AI assistant',
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  proposal_id uuid references proposals(id) on delete set null,
  idempotency_key uuid,
  title text not null,
  description text,
  deliverables text[] not null default '{}',
  requirements text[] not null default '{}',
  deadline_date date,
  deadline_text text,
  timezone text not null default 'UTC',
  budget_amount numeric,
  budget_currency char(3),
  status text not null default 'draft'
    check (status in ('draft','ready','in_progress','delivered','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists orders_user_status_idx on orders (user_id, status);
create index if not exists orders_user_deadline_idx on orders (user_id, deadline_date);

create table if not exists order_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  is_client_requirement boolean not null default false,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tasks_order_pos_idx on order_tasks (order_id, position);

create table if not exists order_activity (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('created','status_changed','edited','task_added','task_updated','task_removed','confirmed')),
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activity_order_created_idx on order_activity (order_id, created_at desc);

create table if not exists ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'offline' check (provider in ('openai_compatible','offline')),
  model text not null default 'gpt-4o-mini',
  key_ciphertext text,
  key_hint text,
  updated_at timestamptz not null default now()
);

-- ============ RLS ============

alter table profiles enable row level security;
alter table clients enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table proposals enable row level security;
alter table orders enable row level security;
alter table order_tasks enable row level security;
alter table order_activity enable row level security;
alter table ai_settings enable row level security;

-- profiles: users read/update their own; creation via trigger only
create policy profiles_sel on profiles for select using (auth.uid() = user_id);
create policy profiles_upd on profiles for update using (auth.uid() = user_id);

-- generic owner policies
create policy clients_all on clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy conv_all on conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy msg_all on messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy prop_all on proposals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy orders_all on orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_all on order_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy act_all on order_activity for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ai_all on ai_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- signup trigger: create profile row
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ atomic confirm RPC ============

create or replace function confirm_intake(
  p_user_id uuid,
  p_conversation_id uuid,
  p_proposal_id uuid,
  p_idempotency_key uuid,
  p_client_id uuid,
  p_new_client_name text,
  p_title text,
  p_description text,
  p_deliverables text[],
  p_requirements text[],
  p_deadline_date date,
  p_deadline_text text,
  p_timezone text,
  p_budget_amount numeric,
  p_budget_currency char(3),
  p_tasks jsonb
) returns table (
  id uuid, user_id uuid, client_id uuid, conversation_id uuid, proposal_id uuid,
  idempotency_key uuid, title text, description text, deliverables text[],
  requirements text[], deadline_date date, deadline_text text, timezone text,
  budget_amount numeric, budget_currency char(3), status text,
  created_at timestamptz, updated_at timestamptz, created boolean
) language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_client_id uuid := p_client_id;
  v_created boolean := true;
  t jsonb;
  i int := 0;
begin
  -- idempotency: return existing row
  select * into v_order from orders where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    v_created := false;
    return query select v_order.id, v_order.user_id, v_order.client_id, v_order.conversation_id,
      v_order.proposal_id, v_order.idempotency_key, v_order.title, v_order.description,
      v_order.deliverables, v_order.requirements, v_order.deadline_date, v_order.deadline_text,
      v_order.timezone, v_order.budget_amount, v_order.budget_currency, v_order.status,
      v_order.created_at, v_order.updated_at, v_created;
    return;
  end if;

  -- ownership checks (defense in depth; RLS also applies to caller, but this
  -- function is SECURITY DEFINER so it must check itself)
  perform 1 from conversations where id = p_conversation_id and user_id = p_user_id;
  if not found then raise exception 'conversation not owned'; end if;
  perform 1 from proposals where id = p_proposal_id and user_id = p_user_id;
  if not found then raise exception 'proposal not owned'; end if;
  if v_client_id is not null then
    perform 1 from clients where id = v_client_id and user_id = p_user_id;
    if not found then raise exception 'client not owned'; end if;
  elsif p_new_client_name is not null then
    insert into clients (user_id, name) values (p_user_id, p_new_client_name)
    returning clients.id into v_client_id;
  end if;

  insert into orders (user_id, client_id, conversation_id, proposal_id, idempotency_key,
    title, description, deliverables, requirements, deadline_date, deadline_text,
    timezone, budget_amount, budget_currency, status)
  values (p_user_id, v_client_id, p_conversation_id, p_proposal_id, p_idempotency_key,
    p_title, p_description, coalesce(p_deliverables, '{}'), coalesce(p_requirements, '{}'),
    p_deadline_date, p_deadline_text, coalesce(p_timezone, 'UTC'),
    p_budget_amount, p_budget_currency, 'draft')
  returning * into v_order;

  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    insert into order_tasks (order_id, user_id, title, is_client_requirement, position)
    values (v_order.id, p_user_id, t->>'title', coalesce((t->>'is_client_requirement')::boolean, false), i);
    i := i + 1;
  end loop;

  update proposals set status = 'confirmed' where id = p_proposal_id and user_id = p_user_id;
  update conversations set status = 'confirmed' where id = p_conversation_id and user_id = p_user_id;
  insert into order_activity (order_id, user_id, kind, detail)
  values (v_order.id, p_user_id, 'confirmed', 'Order confirmed from intake');

  return query select v_order.id, v_order.user_id, v_order.client_id, v_order.conversation_id,
    v_order.proposal_id, v_order.idempotency_key, v_order.title, v_order.description,
    v_order.deliverables, v_order.requirements, v_order.deadline_date, v_order.deadline_text,
    v_order.timezone, v_order.budget_amount, v_order.budget_currency, v_order.status,
    v_order.created_at, v_order.updated_at, v_created;
end $$;
