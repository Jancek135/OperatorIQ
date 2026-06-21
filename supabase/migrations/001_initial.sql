-- =============================================================
-- Standlomat Intelligence — Supabase Migration 001
-- Multi-tenant fleet management for vending operators
-- =============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================
-- ACCOUNTS (one per Betreiber/Operator)
-- =============================================================
create table accounts (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz default now()
);

-- =============================================================
-- PROFILES (extends auth.users — links user to account)
-- =============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  full_name   text,
  role        text not null default 'owner' check (role in ('owner', 'viewer')),
  created_at  timestamptz default now()
);

-- =============================================================
-- MACHINES
-- =============================================================
create table machines (
  id            uuid primary key default uuid_generate_v4(),
  account_id    uuid not null references accounts(id) on delete cascade,
  name          text not null,
  standort      text not null default '',
  miete         numeric not null default 0,
  baseline_rev  numeric not null default 0,   -- constant reference value
  baseline_tx   integer not null default 0,
  sort_order    integer default 0,
  created_at    timestamptz default now()
);

-- =============================================================
-- MACHINE COSTS (Fixkosten pro Maschine)
-- =============================================================
create table machine_costs (
  id          uuid primary key default uuid_generate_v4(),
  machine_id  uuid not null references machines(id) on delete cascade,
  fix_cost    numeric not null default 0,
  updated_at  timestamptz default now(),
  unique(machine_id)
);

-- =============================================================
-- REV OVERRIDES (active CSV import data — latest import wins)
-- =============================================================
create table rev_overrides (
  id           uuid primary key default uuid_generate_v4(),
  account_id   uuid not null references accounts(id) on delete cascade,
  machine_id   uuid not null references machines(id) on delete cascade,
  rev          numeric not null default 0,
  tx           integer not null default 0,
  imported_at  timestamptz default now(),
  unique(machine_id)  -- one active override per machine
);

-- =============================================================
-- SNAPSHOTS (monthly history — up to 3 per machine)
-- =============================================================
create table snapshots (
  id           uuid primary key default uuid_generate_v4(),
  account_id   uuid not null references accounts(id) on delete cascade,
  machine_id   uuid not null references machines(id) on delete cascade,
  month_label  text not null,   -- e.g. "Juni 2026"
  rev          numeric not null default 0,
  tx           integer not null default 0,
  created_at   timestamptz default now(),
  unique(machine_id, month_label)
);

-- =============================================================
-- FLEET SETTINGS (one row per account)
-- =============================================================
create table fleet_settings (
  id              uuid primary key default uuid_generate_v4(),
  account_id      uuid not null references accounts(id) on delete cascade,
  we_rate         numeric not null default 0.27,
  total_fix       numeric not null default 0,
  variable_costs  numeric not null default 0,
  updated_at      timestamptz default now(),
  unique(account_id)
);

-- =============================================================
-- WE OVERRIDES per machine (individuelle Wareneinsatz-Sätze)
-- =============================================================
create table we_overrides (
  id          uuid primary key default uuid_generate_v4(),
  machine_id  uuid not null references machines(id) on delete cascade,
  we_rate     numeric not null,
  updated_at  timestamptz default now(),
  unique(machine_id)
);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

alter table accounts       enable row level security;
alter table profiles       enable row level security;
alter table machines       enable row level security;
alter table machine_costs  enable row level security;
alter table rev_overrides  enable row level security;
alter table snapshots      enable row level security;
alter table fleet_settings enable row level security;
alter table we_overrides   enable row level security;

-- Helper function: get current user's account_id
create or replace function get_my_account_id()
returns uuid
language sql stable
as $$
  select account_id from profiles where id = auth.uid()
$$;

-- ACCOUNTS
create policy "Users can read own account"
  on accounts for select
  using (id = get_my_account_id());

create policy "Users can update own account"
  on accounts for update
  using (id = get_my_account_id());

-- PROFILES
create policy "Users can read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- MACHINES
create policy "Users can read own machines"
  on machines for select
  using (account_id = get_my_account_id());

create policy "Owners can insert machines"
  on machines for insert
  with check (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update machines"
  on machines for update
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can delete machines"
  on machines for delete
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- MACHINE COSTS
create policy "Users can read machine costs"
  on machine_costs for select
  using (
    machine_id in (select id from machines where account_id = get_my_account_id())
  );

create policy "Owners can upsert machine costs"
  on machine_costs for insert
  with check (
    machine_id in (select id from machines where account_id = get_my_account_id())
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update machine costs"
  on machine_costs for update
  using (
    machine_id in (select id from machines where account_id = get_my_account_id())
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- REV OVERRIDES
create policy "Users can read rev overrides"
  on rev_overrides for select
  using (account_id = get_my_account_id());

create policy "Owners can upsert rev overrides"
  on rev_overrides for insert
  with check (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update rev overrides"
  on rev_overrides for update
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can delete rev overrides"
  on rev_overrides for delete
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- SNAPSHOTS
create policy "Users can read snapshots"
  on snapshots for select
  using (account_id = get_my_account_id());

create policy "Owners can insert snapshots"
  on snapshots for insert
  with check (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update snapshots"
  on snapshots for update
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- FLEET SETTINGS
create policy "Users can read fleet settings"
  on fleet_settings for select
  using (account_id = get_my_account_id());

create policy "Owners can upsert fleet settings"
  on fleet_settings for insert
  with check (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update fleet settings"
  on fleet_settings for update
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- WE OVERRIDES
create policy "Users can read WE overrides"
  on we_overrides for select
  using (
    machine_id in (select id from machines where account_id = get_my_account_id())
  );

create policy "Owners can upsert WE overrides"
  on we_overrides for insert
  with check (
    machine_id in (select id from machines where account_id = get_my_account_id())
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update WE overrides"
  on we_overrides for update
  using (
    machine_id in (select id from machines where account_id = get_my_account_id())
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- =============================================================
-- TRIGGER: Auto-create profile + account on first signup
-- =============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_account_id uuid;
begin
  -- Create account
  insert into accounts (name)
  values (coalesce(new.raw_user_meta_data->>'company_name', 'Mein Betrieb'))
  returning id into new_account_id;

  -- Create profile
  insert into profiles (id, account_id, full_name, role)
  values (
    new.id,
    new_account_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'owner'
  );

  -- Create default fleet settings
  insert into fleet_settings (account_id, we_rate, total_fix, variable_costs)
  values (new_account_id, 0.27, 0, 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================================
-- INDEXES for performance
-- =============================================================
create index on machines        (account_id);
create index on machine_costs   (machine_id);
create index on rev_overrides   (account_id);
create index on rev_overrides   (machine_id);
create index on snapshots       (account_id);
create index on snapshots       (machine_id, month_label);
create index on fleet_settings  (account_id);
create index on we_overrides    (machine_id);
