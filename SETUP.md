# Standlomat Intelligence — Setup Guide

## Voraussetzungen

- Node.js 18+ installiert
- Supabase Account (supabase.com)
- Vercel Account (vercel.com) — für Deployment

---

## 1. Supabase Projekt anlegen

1. Geh auf **supabase.com** → New Project
2. Name: `standlomat` (oder beliebig)
3. Datenbank-Passwort notieren
4. Region: **Frankfurt (eu-central-1)**

---

## 2. Datenbank-Schema einrichten

1. Im Supabase Dashboard → **SQL Editor**
2. Inhalt von `supabase/migrations/001_initial.sql` komplett reinkopieren
3. **Run** klicken
4. Alle Tabellen sollten unter **Table Editor** erscheinen

---

## 3. Auth konfigurieren

Im Supabase Dashboard → **Authentication** → **Providers**:
- Email aktiviert lassen (Standard)
- Optional: unter **URL Configuration** deine Domain eintragen

---

## 4. Environment Variables einrichten

```bash
cp .env.local.example .env.local
```

Dann `.env.local` öffnen und befüllen:

Im Supabase Dashboard → **Settings** → **API**:
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL (z.B. `https://xxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon` / `public` Key

---

## 5. Lokal starten

```bash
npm install
npm run dev
```

Öffne **http://localhost:3000** → du wirst zu `/login` weitergeleitet.

Registriere dich mit deiner E-Mail. Der Trigger in Supabase erstellt automatisch:
- Einen Account für dich
- Dein Profil (Owner-Rolle)
- Standard-Fleet-Einstellungen (WE 27%)

---

## 6. Erste Maschinen anlegen

Nach dem Login:
1. **Maschinen** → **+ Maschine hinzufügen**
2. Name, Standort, Baseline-Umsatz, TX, Miete, Fixkosten eingeben
3. Maschinen erscheinen sofort im Dashboard

---

## 7. CSV Import testen

1. Dashboard oder Maschinen-Seite → **⬆ CSV Import**
2. Televend/Nayax CSV-Export hochladen
3. Preview prüfen → Importieren

Erkannte Spalten-Keywords:
- **Name**: `name`, `bezeichnung`, `maschine`, `gerät`
- **Umsatz**: `umsatz`, `revenue`, `betrag`, `summe`, `erlös`
- **TX**: `transaktion`, `verkauf`, `anzahl`, `count`, `vend`

---

## 8. Snapshot speichern

**📸 Snapshot** klicken → speichert den aktuellen Monat für alle Maschinen.
Bis zu 3 Monate werden als Sparkline angezeigt.

---

## 9. Auf Vercel deployen

```bash
npm install -g vercel
vercel
```

Oder via GitHub:
1. Projekt zu GitHub pushen
2. vercel.com → **New Project** → GitHub Repo importieren
3. Environment Variables in Vercel eintragen (dieselben wie `.env.local`)
4. Deploy

---

## Projektstruktur

```
standlomat-saas/
├── app/
│   ├── (auth)/          # Login, Register
│   ├── (dashboard)/     # Dashboard, Maschinen, Standorte, Einstellungen
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── NavClient.tsx    # Sidebar Navigation
│   ├── MachineCard.tsx  # Maschinenkarte mit Status, Sparkline
│   ├── Sparkline.tsx    # SVG Trend-Chart
│   ├── CSVImport.tsx    # CSV Import Modal
│   └── AddMachineModal.tsx
├── lib/
│   ├── calculations.ts  # Gesamte Business-Logik (getMRev, status, insights, ...)
│   ├── types.ts         # TypeScript Interfaces
│   └── supabase/        # Client + Server Supabase Instanzen
├── middleware.ts         # Auth Route Protection
└── supabase/
    └── migrations/
        └── 001_initial.sql
```

---

## Preismodell-Vorschlag

| Tier       | Maschinen | Preis/Monat |
|------------|-----------|-------------|
| Starter    | bis 5     | €29         |
| Betreiber  | bis 25    | €79         |
| Flotte     | unbegrenzt| €149        |

Billing über **Stripe** integrieren wenn erster zahlender Kunde da ist.

---

## Nächste Features (Post-MVP)

- [ ] Stripe Billing + Subscription Tiers
- [ ] E-Mail Reports (wöchentlich, monatlich)
- [ ] Direkte Televend/Nayax API Integration (kein CSV mehr)
- [ ] Mobile-optimierte Ansicht
- [ ] Mehrere User pro Account (Viewer-Rolle)
- [ ] Automatische Snapshot-Erinnerung am Monatsende
