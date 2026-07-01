-- =============================================================
-- Migration 004 — Befüllplan (Fahrer-View)
-- Manuelle Zuordnung: welches Produkt in welcher Menge soll
-- bei welchem Standort nachgefüllt werden.
-- =============================================================

create table refill_items (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references accounts(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  product_id  uuid not null references catalog_products(id) on delete cascade,
  menge       integer not null default 1,
  erledigt    boolean not null default false,
  notiz       text,
  created_at  timestamptz default now()
);

create index on refill_items (account_id);
create index on refill_items (location_id);

-- ── Cross-tenant guard: location_id + product_id müssen zum selben account gehören ──
create or replace function check_refill_item_tenant()
returns trigger as $$
begin
  if not exists (select 1 from locations where id = new.location_id and account_id = new.account_id) then
    raise exception 'location_id gehört nicht zum eigenen Account';
  end if;
  if not exists (select 1 from catalog_products where id = new.product_id and account_id = new.account_id) then
    raise exception 'product_id gehört nicht zum eigenen Account';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_check_refill_item_tenant
  before insert or update on refill_items
  for each row execute function check_refill_item_tenant();

-- ── RLS ───────────────────────────────────────────────────────
alter table refill_items enable row level security;

create policy "Users can read own refill_items"
  on refill_items for select
  using (account_id = get_my_account_id());

create policy "Owners can insert refill_items"
  on refill_items for insert
  with check (account_id = get_my_account_id());

create policy "Owners can update refill_items"
  on refill_items for update
  using (account_id = get_my_account_id())
  with check (account_id = get_my_account_id());

create policy "Owners can delete refill_items"
  on refill_items for delete
  using (account_id = get_my_account_id());
