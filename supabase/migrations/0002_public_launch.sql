-- Required public-launch hardening. Apply after 0001_init.sql, in order.
begin;

-- Application mutations go through validated, authenticated Next.js routes.
-- Keep owner-filtered read policies; deny direct browser writes that bypass
-- transition checks, parent ownership, idempotency, and AI validation.
revoke insert, update, delete, truncate, references, trigger on
  public.profiles, public.clients, public.conversations, public.messages,
  public.proposals, public.orders, public.order_tasks, public.order_activity,
  public.ai_settings from anon, authenticated;
revoke all on public.ai_settings from anon, authenticated;
grant all on public.profiles, public.clients, public.conversations, public.messages,
  public.proposals, public.orders, public.order_tasks, public.order_activity,
  public.ai_settings to service_role;

create unique index if not exists orders_one_per_conversation
  on public.orders (user_id, conversation_id) where conversation_id is not null;
create unique index if not exists orders_one_per_proposal
  on public.orders (user_id, proposal_id) where proposal_id is not null;

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
  v_order public.orders%rowtype;
  v_client_id uuid := p_client_id;
  v_conv_status text;
  v_prop_status text;
  t jsonb;
  i int := 0;
begin
  -- Serializes confirmations for this owner across all application instances.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select c.status into v_conv_status from public.conversations c
    where c.id = p_conversation_id and c.user_id = p_user_id for update;
  if not found then raise exception 'conversation not owned'; end if;
  select p.status into v_prop_status from public.proposals p
    where p.id = p_proposal_id and p.user_id = p_user_id
      and p.conversation_id = p_conversation_id for update;
  if not found then raise exception 'proposal not owned by conversation'; end if;

  select o.* into v_order from public.orders o
    where o.user_id = p_user_id and o.idempotency_key = p_idempotency_key;
  if found and (v_order.conversation_id is distinct from p_conversation_id
                or v_order.proposal_id is distinct from p_proposal_id) then
    raise exception 'confirmation key belongs to another intake';
  end if;
  if not found then
    select o.* into v_order from public.orders o
      where o.user_id = p_user_id and o.conversation_id = p_conversation_id;
  end if;
  if found then
    return query select v_order.id, v_order.user_id, v_order.client_id, v_order.conversation_id,
      v_order.proposal_id, v_order.idempotency_key, v_order.title, v_order.description,
      v_order.deliverables, v_order.requirements, v_order.deadline_date, v_order.deadline_text,
      v_order.timezone, v_order.budget_amount, v_order.budget_currency, v_order.status,
      v_order.created_at, v_order.updated_at, false;
    return;
  end if;
  if v_conv_status = 'confirmed' or v_prop_status not in ('draft', 'ready') then
    raise exception 'intake is no longer open';
  end if;

  if v_client_id is not null then
    perform 1 from public.clients c where c.id = v_client_id and c.user_id = p_user_id;
    if not found then raise exception 'client not owned'; end if;
  elsif p_new_client_name is not null then
    insert into public.clients (user_id, name) values (p_user_id, p_new_client_name)
      returning clients.id into v_client_id;
  end if;
  insert into public.orders as o (user_id, client_id, conversation_id, proposal_id, idempotency_key,
    title, description, deliverables, requirements, deadline_date, deadline_text,
    timezone, budget_amount, budget_currency, status)
  values (p_user_id, v_client_id, p_conversation_id, p_proposal_id, p_idempotency_key,
    p_title, p_description, coalesce(p_deliverables, '{}'), coalesce(p_requirements, '{}'),
    p_deadline_date, p_deadline_text, coalesce(p_timezone, 'UTC'), p_budget_amount, p_budget_currency, 'draft')
  returning o.* into v_order;
  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    insert into public.order_tasks (order_id, user_id, title, is_client_requirement, position)
      values (v_order.id, p_user_id, t->>'title', coalesce((t->>'is_client_requirement')::boolean, false), i);
    i := i + 1;
  end loop;
  update public.proposals p set status = 'confirmed' where p.id = p_proposal_id and p.user_id = p_user_id;
  update public.conversations c set status = 'confirmed', updated_at = now() where c.id = p_conversation_id and c.user_id = p_user_id;
  insert into public.order_activity (order_id, user_id, kind, detail)
    values (v_order.id, p_user_id, 'confirmed', 'Order confirmed from intake');
  return query select v_order.id, v_order.user_id, v_order.client_id, v_order.conversation_id,
    v_order.proposal_id, v_order.idempotency_key, v_order.title, v_order.description,
    v_order.deliverables, v_order.requirements, v_order.deadline_date, v_order.deadline_text,
    v_order.timezone, v_order.budget_amount, v_order.budget_currency, v_order.status,
    v_order.created_at, v_order.updated_at, true;
end $$;

revoke all on function public.confirm_intake(uuid, uuid, uuid, uuid, uuid, text, text, text, text[], text[], date, text, text, numeric, char, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_intake(uuid, uuid, uuid, uuid, uuid, text, text, text, text[], text[], date, text, text, numeric, char, jsonb) to service_role;

-- Manual order + checklist + activity succeed or roll back together.
create or replace function public.create_order_manual(p_user_id uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_client uuid := nullif(p_data->>'clientId', '')::uuid;
  t jsonb;
  i int := 0;
begin
  if v_client is not null then
    perform 1 from public.clients c where c.id = v_client and c.user_id = p_user_id;
    if not found then raise exception 'client not owned'; end if;
  end if;
  insert into public.orders as o (user_id, client_id, title, description, deliverables,
    requirements, deadline_date, deadline_text, timezone, budget_amount, budget_currency, status)
  values (p_user_id, v_client, p_data->>'title', p_data->>'description',
    array(select jsonb_array_elements_text(p_data->'deliverables')),
    array(select jsonb_array_elements_text(p_data->'requirements')),
    (p_data->>'deadlineDate')::date, p_data->>'deadlineText', coalesce(p_data->>'timezone', 'UTC'),
    (p_data->>'budgetAmount')::numeric, p_data->>'budgetCurrency', 'draft')
  returning o.* into v_order;
  for t in select * from jsonb_array_elements(coalesce(p_data->'tasks', '[]'::jsonb)) loop
    insert into public.order_tasks (order_id, user_id, title, is_client_requirement, position)
    values (v_order.id, p_user_id, t->>'title', coalesce((t->>'isClientRequirement')::boolean, false), i);
    i := i + 1;
  end loop;
  insert into public.order_activity (order_id, user_id, kind, detail)
    values (v_order.id, p_user_id, 'created', 'Order created');
  return to_jsonb(v_order);
end $$;
revoke all on function public.create_order_manual(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_manual(uuid, jsonb) to service_role;

-- Cross-instance rate limiting. Keys are salted hashes, never raw emails/IPs.
create table if not exists public.rate_limit_buckets (
  key text primary key,
  hits integer not null,
  expires_at timestamptz not null
);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;
grant all on public.rate_limit_buckets to service_role;
create index if not exists rate_limit_expiry on public.rate_limit_buckets(expires_at);
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits integer;
begin
  delete from public.rate_limit_buckets where expires_at < now();
  insert into public.rate_limit_buckets as b (key, hits, expires_at) values (p_key, 1, p_expires_at)
    on conflict (key) do update set hits = b.hits + 1
    returning hits into v_hits;
  return v_hits <= p_limit;
end $$;
revoke all on function public.consume_rate_limit(text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, timestamptz) to service_role;

-- Preferences are created from validated signup metadata, without a later
-- service-role update that could target an existing unconfirmed account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, display_name, timezone, default_currency)
  values (new.id, new.email,
    left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 120),
    case when exists (select 1 from pg_timezone_names where name = new.raw_user_meta_data->>'timezone')
      then new.raw_user_meta_data->>'timezone' else 'UTC' end,
    case when new.raw_user_meta_data->>'default_currency' ~ '^[A-Z]{3}$'
      then new.raw_user_meta_data->>'default_currency' else 'EGP' end);
  return new;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch before update on public.conversations for each row execute function public.touch_updated_at();
drop trigger if exists ai_settings_touch on public.ai_settings;
create trigger ai_settings_touch before update on public.ai_settings for each row execute function public.touch_updated_at();
commit;
