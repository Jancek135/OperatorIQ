-- =============================================================
-- Standlomat — Migration 002 (Production-ready)
-- Locations, Suppliers, Catalog Products
-- machines.standort (text) → location_id (FK)
--
-- Fixes vs. draft:
--   [1] RLS: Viewer-Policies für suppliers + catalog_products getrennt
--   [2] Cross-tenant: Trigger verhindert supplier_id aus fremdem Account
--   [3] Composite index auf catalog_products(account_id, aktiv)
--   [4] Datenmigration befüllt locations.miete aus machines.miete
--   [5] UNIQUE constraint auf locations(account_id, name)
-- =============================================================

-- ── LOCATIONS ─────────────────────────────────────────────────
create table locations (
  id              uuid primary key default uuid_generate_v4(),
  account_id      uuid not null references accounts(id) on delete cascade,
  name            text not null,
  adresse         text,
  plz             text,
  ort             text,
  ansprechpartner text,
  telefon         text,
  miete           numeric not null default 0,
  notizen         text,
  created_at      timestamptz default now(),
  -- [Fix 5] Kein doppelter Standortname pro Account
  unique (account_id, name)
);

-- ── SUPPLIERS ─────────────────────────────────────────────────
create table suppliers (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  kontakt     text,
  telefon     text,
  email       text,
  notizen     text,
  created_at  timestamptz default now()
);

-- ── CATALOG PRODUCTS ──────────────────────────────────────────
-- Produktstammdaten ohne Bestand (kommt in Phase 2).
create table catalog_products (
  id              uuid primary key default uuid_generate_v4(),
  account_id      uuid not null references accounts(id) on delete cascade,
  supplier_id     uuid references suppliers(id) on delete set null,
  name            text not null,
  barcode         text,
  kategorie       text,
  emoji           text,
  image_url       text,
  ek              numeric(10,2) not null default 0,
  vk              numeric(10,2) not null default 0,
  mwst_satz       numeric not null default 0.20,
  mindestbestand  integer not null default 0,
  einheit         text not null default 'Stk',
  sort_order      integer not null default 0,
  aktiv           boolean not null default true,
  created_at      timestamptz default now()
);

-- ── machines: location_id hinzufügen ──────────────────────────
-- standort (text) bleibt als Fallback — wird in Migration 003 entfernt.
alter table machines
  add column location_id uuid references locations(id) on delete set null;

-- ── DATENMIGRATION ────────────────────────────────────────────
-- [Fix 4] locations.miete wird mit dem MAX(machines.miete) des Standorts
-- initialisiert — besser als 0, als Startwert für die Location-UI.
do $$
declare
  r record;
  new_location_id uuid;
begin
  for r in
    select
      account_id,
      standort,
      max(miete) as max_miete   -- [Fix 4] Miete aus Maschinendaten übernehmen
    from machines
    where standort is not null and standort <> ''
    group by account_id, standort
  loop
    insert into locations (account_id, name, miete)
    values (r.account_id, r.standort, r.max_miete)
    returning id into new_location_id;

    update machines
    set location_id = new_location_id
    where account_id = r.account_id
      and standort = r.standort;
  end loop;
end;
$$;

-- ── [Fix 2] CROSS-TENANT TRIGGER: supplier_id muss zum selben Account gehören
-- Verhindert, dass ein Owner einer anderen Tenant-Supplier referenziert.
create or replace function check_supplier_account()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.supplier_id is not null then
    if not exists (
      select 1 from suppliers
      where id = new.supplier_id
        and account_id = new.account_id
    ) then
      raise exception 'supplier_id does not belong to the same account';
    end if;
  end if;
  return new;
end;
$$;

create trigger catalog_products_supplier_account_check
  before insert or update on catalog_products
  for each row execute function check_supplier_account();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

alter table locations        enable row level security;
alter table suppliers        enable row level security;
alter table catalog_products enable row level security;

-- ── LOCATIONS ──
-- [Fix 1] SELECT für alle User (owner + viewer)
create policy "Users can read own locations"
  on locations for select
  using (account_id = get_my_account_id());

-- Mutationen nur für Owner — identisches Pattern wie 001_initial.sql
create policy "Owners can insert locations"
  on locations for insert
  with check (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update locations"
  on locations for update
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can delete locations"
  on locations for delete
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- ── SUPPLIERS ──
-- [Fix 1] SELECT für alle User getrennt von Mutationen
create policy "Users can read own suppliers"
  on suppliers for select
  using (account_id = get_my_account_id());

create policy "Owners can insert suppliers"
  on suppliers for insert
  with check (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update suppliers"
  on suppliers for update
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can delete suppliers"
  on suppliers for delete
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- ── CATALOG PRODUCTS ──
-- [Fix 1] SELECT für alle User getrennt von Mutationen
create policy "Users can read own products"
  on catalog_products for select
  using (account_id = get_my_account_id());

create policy "Owners can insert products"
  on catalog_products for insert
  with check (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can update products"
  on catalog_products for update
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

create policy "Owners can delete products"
  on catalog_products for delete
  using (
    account_id = get_my_account_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- ── INDEXES ───────────────────────────────────────────────────
create index on locations        (account_id);
create index on suppliers        (account_id);
-- [Fix 3] Composite index für WHERE account_id = ? AND aktiv = true
create index on catalog_products (account_id, aktiv);
create index on catalog_products (supplier_id);
create index on machines         (location_id);
