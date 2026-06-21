-- =============================================================
-- Standlomat → VendoAI — Migration 003
-- Multi-Tenant Infrastructure
--
-- Ziel: Grundlage für beliebig viele Kunden (Workspaces) ohne
-- Codeänderungen. Keine bestehenden Daten, Screens oder Funktionen
-- werden verändert. Alle neuen Felder sind optional (nullable).
--
-- Neues in accounts:
--   slug          — eindeutiger Workspace-Bezeichner (URL-safe)
--   logo_url      — optionales Branding
--   primary_color — optionales Branding (Hex, z.B. #38bdf8)
--   plan          — Subscription-Tier (free/pro/enterprise)
-- =============================================================

-- ── Neue Felder in accounts ───────────────────────────────────
alter table accounts
  add column if not exists slug          text unique,
  add column if not exists logo_url      text,
  add column if not exists primary_color text,
  add column if not exists plan          text not null default 'free'
    check (plan in ('free', 'pro', 'enterprise'));

-- ── Hilfsfunktion: Text → URL-sicherer Slug ──────────────────
-- Erzeugt "Mein Betrieb GmbH" → "mein-betrieb-gmbh"
-- Behandelt Umlaute und Sonderzeichen.
create or replace function generate_slug(input text)
returns text
language plpgsql
as $$
declare
  result text;
  counter int := 1;
  candidate text;
begin
  -- Normalisieren: Umlaute ersetzen, lowercase, Sonderzeichen → Bindestrich
  result := lower(input);
  result := replace(result, 'ä', 'ae');
  result := replace(result, 'ö', 'oe');
  result := replace(result, 'ü', 'ue');
  result := replace(result, 'ß', 'ss');
  -- Alles außer a-z, 0-9 → Bindestrich
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  -- Führende/abschließende Bindestriche entfernen
  result := trim(both '-' from result);
  -- Leerstring-Fallback
  if result = '' then result := 'workspace'; end if;

  -- Eindeutigkeit sicherstellen
  candidate := result;
  loop
    if not exists (select 1 from accounts where slug = candidate) then
      return candidate;
    end if;
    counter := counter + 1;
    candidate := result || '-' || counter;
  end loop;
end;
$$;

-- ── Bestehenden StandLomat-Account mit Slug versehen ─────────
-- Der einzige Account wird explizit "standlomat" genannt.
-- Alle anderen Felder bleiben unverändert.
update accounts
set slug = 'standlomat'
where slug is null;

-- ── Trigger: Slug bei Neu-Anmeldung automatisch erzeugen ─────
-- Ersetzt handle_new_user() — existierende Logik bleibt identisch,
-- nur slug-Befüllung wird ergänzt.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_account_id uuid;
  company text;
  new_slug text;
begin
  company := coalesce(
    nullif(trim(new.raw_user_meta_data->>'company_name'), ''),
    new.email
  );

  -- Slug aus Firmenname ableiten
  new_slug := generate_slug(company);

  -- Account anlegen (inkl. slug)
  insert into accounts (name, slug)
  values (company, new_slug)
  returning id into new_account_id;

  -- Profile anlegen
  insert into profiles (id, account_id, full_name, role)
  values (
    new.id,
    new_account_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'owner'
  );

  -- Standard-Flotteneinstellungen
  insert into fleet_settings (account_id, we_rate, total_fix, variable_costs)
  values (new_account_id, 0.27, 0, 0);

  return new;
end;
$$;
-- Trigger selbst bleibt bestehen (on_auth_user_created), Funktion wurde oben ersetzt.

-- ── Index auf slug für schnelle Workspace-Lookups ─────────────
create index if not exists accounts_slug_idx on accounts (slug);

-- ── RLS: Branding-Felder lesbar (kein separates Policy nötig) ─
-- Die bestehende Policy "Users can read own account" deckt alle
-- Spalten von accounts ab — also auch die neuen Felder. ✓
