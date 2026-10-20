-- Ours: shared couple's list — Postgres schema (Neon via the Vercel Marketplace).
-- Idempotent: safe to run again on every deploy/setup.
--
-- The browser never talks to the database. Every query goes through a Next.js
-- route that checks the unlock cookie and scopes it to the deployment's one space.
-- Live sync: triggers pg_notify() on channel "ours" for each change; the
-- /api/events route LISTENs and streams matching changes to each device (SSE).

create extension if not exists pgcrypto;

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ours',
  member_names text[] not null default '{}',
  priority_labels text[] not null default array['Low', 'Medium', 'High'],
  default_currency text not null default 'GBP',
  created_at timestamptz not null default now()
);

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  emoji text not null default 'icon:star',
  color text not null default 'clay',
  position double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists field_defs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  list_id uuid not null references lists (id) on delete cascade,
  key text not null,
  label text not null check (char_length(label) between 1 and 60),
  type text not null check (type in ('text', 'number', 'date', 'link', 'select', 'checkbox')),
  options text[] not null default '{}',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, key)
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  list_id uuid not null references lists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  notes text,
  url text,
  price numeric(12, 2),
  currency text,
  priority smallint check (priority between 0 and 2),
  target_date date,
  status text not null default 'idea' check (status in ('idea', 'planned', 'done')),
  location text,
  tags text[] not null default '{}',
  who_wants text,
  added_by text,
  updated_by text,
  position double precision not null default 0,
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);

create table if not exists item_photos (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  item_id uuid not null references items (id) on delete cascade,
  blob_url text not null,
  width integer,
  height integer,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

-- Wrong unlock codes per IP: 5 tries, then a 15-minute pause.
create table if not exists unlock_attempts (
  ip text primary key,
  failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists presence (
  space_id uuid not null references spaces (id) on delete cascade,
  device_id text not null,
  name text not null,
  last_seen timestamptz not null default now(),
  primary key (space_id, device_id)
);

create index if not exists lists_space_idx on lists (space_id, position);
create index if not exists field_defs_list_idx on field_defs (list_id, position);
create index if not exists items_space_idx on items (space_id);
create index if not exists items_list_idx on items (list_id, status);
create index if not exists item_photos_item_idx on item_photos (item_id, position);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lists_touch on lists;
create trigger lists_touch before update on lists for each row execute function touch_updated_at();
drop trigger if exists items_touch on items;
create trigger items_touch before update on items for each row execute function touch_updated_at();

-- Broadcast every change. Rows larger than NOTIFY's 8 kB limit are sent
-- without the row body; clients then refetch.
create or replace function notify_change() returns trigger language plpgsql as $$
declare
  rec record;
  payload jsonb;
  body text;
  row_json jsonb;
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  row_json := to_jsonb(rec);
  payload := jsonb_build_object(
    'space', case when tg_table_name = 'spaces' then row_json ->> 'id' else row_json ->> 'space_id' end,
    'table', tg_table_name,
    'op', tg_op,
    'id', row_json ->> 'id',
    'row', case when tg_op = 'DELETE' then null else row_json end
  );
  body := payload::text;
  if octet_length(body) > 7800 then
    body := (payload - 'row' || jsonb_build_object('refetch', true))::text;
  end if;
  perform pg_notify('ours', body);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['spaces', 'lists', 'field_defs', 'items', 'item_photos'] loop
    execute format('drop trigger if exists %1$s_notify on %1$I', t);
    execute format('create trigger %1$s_notify after insert or update or delete on %1$I
                    for each row execute function notify_change()', t);
  end loop;
end;
$$;

-- Presence changes are broadcast separately (no row body needed).
create or replace function notify_presence() returns trigger language plpgsql as $$
declare
  rec record;
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  perform pg_notify('ours', jsonb_build_object(
    'space', rec.space_id, 'table', 'presence', 'op', tg_op,
    'id', rec.device_id, 'row', jsonb_build_object('device_id', rec.device_id, 'name', rec.name, 'last_seen', rec.last_seen)
  )::text);
  return null;
end;
$$;

drop trigger if exists presence_notify on presence;
create trigger presence_notify after insert or update or delete on presence
  for each row execute function notify_presence();
