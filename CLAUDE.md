# Standlomat — Claude Code Kontext

> Diese Datei wird automatisch von Claude Code Sessions gelesen.
> Bitte NICHT löschen. Bei Änderungen immer aktuell halten.

---

## 1. Vision & Positionierung

**Standlomat ist keine Dashboard-App. Es ist eine AI Operating Platform für Automatenunternehmen.**

Die Kernfrage die das Produkt beantwortet: *Was muss ich heute tun, damit mein Betrieb morgen profitabler ist?*

**Nicht:** "Du hast 12.500 € Umsatz gemacht."
**Sondern:** "Du hast 4.320 € Gewinn erzielt. Standort A bindet zu viel Kapital, Standort B liefert die höchste Rendite, zwei Produkte solltest du auslisten und eine Nachbestellung über 380 € wird empfohlen."

**Zielgruppe:** Automatenunternehmen mit 20+ Maschinen (dort beginnt der wirtschaftliche Nutzen).

**Preismodell:** 149–249 € / Monat SaaS. Jedes neue Feature muss die Frage bestehen: *Würde ein Geschäftsführer dafür zahlen?*

**Architektur (4 Ebenen):**
```
Data Layer      → CSV, Televend, Nayax, Vendon, Excel, Rechnungen
Business Layer  → Gewinn, DB, Kapitalbindung, ROI, Standortprofitabilität
Intelligence    → AI-Analyse, Empfehlungen, Forecast, Alerts
Execution       → Bestellungen vorbereiten, PDFs, Aufgaben
```

**Burggraben:** Nicht die API-Anbindung — sondern alle Daten eines Automatenbetriebs an einem Ort + AI-Auswertung. Das kann kein Telemetrieanbieter einfach kopieren.

---

## 2. Tech-Stack

| Tool | Zweck |
|------|-------|
| **Next.js 14** | App Router, TypeScript, Server + Client Components |
| **Supabase** | Postgres + Auth + RLS (Project: `bdlokeizgaylgtcwgdfw`) |
| **@supabase/ssr** | Cookie-basierte Auth, kein JWT-Chaos |
| **lucide-react** | Icons (KEIN anderes Icon-System verwenden) |
| **CSS Custom Properties** | Design-System (kein Tailwind für Logik, nur für Base-Reset) |

**Supabase URLs:**
```
NEXT_PUBLIC_SUPABASE_URL=https://bdlokeizgaylgtcwgdfw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkbG9rZWl6Z2F5bGd0Y3dnZGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDg4MDUsImV4cCI6MjA5NzM4NDgwNX0.pGc__bA6ugxcmm7sMtwcFt2u63vLnIb2Ytml4w0SHnE
```

**Supabase Clients:**
```typescript
// Server Component / Route Handler
import { createClient } from '@/lib/supabase/server'

// Client Component
import { createClient } from '@/lib/supabase/client'
```

---

## 3. Datenbankschema

### Tabellen

```sql
accounts        id, name, created_at
profiles        id, account_id, full_name, role, created_at
machines        id, account_id, name, standort, miete, baseline_rev, baseline_tx, sort_order, created_at
machine_costs   id, machine_id, fix_cost, updated_at          -- UNIQUE(machine_id)
we_overrides    id, machine_id, we_rate, updated_at           -- UNIQUE(machine_id)
rev_overrides   id, account_id, machine_id, rev, tx, imported_at
snapshots       id, account_id, machine_id, month_label, rev, tx, created_at
fleet_settings  id, account_id, we_rate, total_fix, variable_costs, cost_items(JSONB), updated_at
```

### RLS-Prinzip
Alle Tabellen sind über `get_my_account_id()` abgesichert — User sieht nur Daten seiner `account_id`. Kein direktes `auth.uid()` in Queries nötig.

### Multi-Tenancy
```typescript
// Standard-Pattern für jede Server-Page:
const { data: profile } = await supabase
  .from('profiles')
  .select('account_id, full_name')
  .eq('id', user.id)
  .single()
const accountId = profile.account_id
```

---

## 4. Kern-Datenmodell (TypeScript)

```typescript
// lib/types.ts
interface Machine {
  id: string
  account_id: string
  name: string
  standort: string
  miete: number
  baseline_rev: number
  baseline_tx: number
  sort_order: number
  // Joined beim Laden:
  fix_cost?: number           // aus machine_costs
  we_rate_override?: number   // aus we_overrides
  rev_override?: number       // aus rev_overrides (CSV-Import)
  tx_override?: number        // aus rev_overrides
}

interface FleetSettings {
  we_rate: number         // z.B. 0.35 für 35%
  total_fix: number       // Summe aller Fixkosten (€/Monat)
  variable_costs: number  // Variable Kosten (€/Monat)
}

interface Snapshot {
  machine_id: string
  month_label: string   // z.B. "Jänner 2025"
  rev: number
  tx: number
}
```

---

## 5. Override-Architektur (WICHTIG)

Daten haben eine Prioritätskette — immer `getMRev()` / `getMTx()` verwenden, NIE direkt `baseline_rev`:

```
CSV-Import (rev_overrides)  →  höchste Priorität
           ↓ falls nicht vorhanden
Baseline (machines.baseline_rev)

WE-Override (we_overrides)  →  höchste Priorität
           ↓ falls nicht vorhanden
Fleet-Default (fleet_settings.we_rate)
```

```typescript
// lib/calculations.ts — immer diese Funktionen verwenden:
getMRev(m: Machine)                    // Umsatz (Override > Baseline)
getMTx(m: Machine)                     // Transaktionen
getMWE(m, defaultWE)                   // WE-Rate (Machine-Override > Fleet)
getFleetRev(machines)                  // Summe Fleet-Umsatz
calcProfit(machines, settings)         // Monatsgewinn
```

---

## 6. Gewinnformel

```typescript
// Monatsgewinn (calcProfit):
profit = fleetRev * (1 - we_rate) - (total_fix + variable_costs)

// DB1 pro Maschine:
db1 = getMRev(m) * (1 - getMWE(m, settings.we_rate))

// Maschinenprofit (wenn fix_cost gesetzt):
machineProfit = db1 - (m.fix_cost + m.miete)

// Break-Even-Umsatz:
breakEven = (total_fix + variable_costs) / (1 - we_rate)
```

---

## 7. Design-System

**ALLES** über CSS Custom Properties in `app/globals.css`. Keine hardcodierten Farben.

```css
/* Farben */
--bg:     #050816   /* Seitenhintergrund */
--s1:     #07111f   /* Sidebar */
--s2:     #0c1730   /* Cards */
--s3:     #132142   /* Inputs, hover */
--s4:     #1a2e55   /* Active/elevated */
--text:   #dce6f5
--muted:  #3d5275
--label:  #7a94b8
--border: rgba(255,255,255,0.042)
--teal:   #38bdf8   /* Primary accent */
--green:  #34d399
--yellow: #fbbf24
--red:    #f87171
--purple: #a78bfa

/* Semantic dims (für Hintergründe) */
--gdim: rgba(52,211,153,0.09)
--rdim: rgba(248,113,113,0.09)
--ydim: rgba(251,191,36,0.09)
--bdim: rgba(56,189,248,0.09)
```

**CSS-Klassen (NUR diese verwenden, nie neu erfinden):**
```
.card           → Standard-Karte (--s2 Hintergrund)
.card-sm        → Kleinere Karte (--s3 Hintergrund)
.card-glow      → Karte mit AI-Highlight (blauer Border)
.btn            → Basis-Button
.btn-primary    → Teal-Gradient Button
.btn-ghost      → Dezenter Button
.btn-danger     → Rot
.btn-success    → Grün
.input          → Eingabefeld
.chip           → Badge/Chip (inline)
.chip-g / .chip-y / .chip-r / .chip-b  → Farbige Chips
.nav-link       → Nav-Link (mit .active für aktiv)
.machine-grid   → CSS Grid für Maschinen-Karten
.kpi-grid       → CSS Grid für KPI-Kacheln
.modal-overlay  → Overlay-Hintergrund
.modal-box      → Modal-Container
.data-table     → Tabelle
.label-sm       → Kleines Label (uppercase, muted)
.fade-in        → Einblend-Animation
.page-pad       → Seitenpadding (wird auf Mobile überschrieben)
```

**Icons:** Immer lucide-react. Größen: 13, 14, 15, 17, 18, 20, 22 px. strokeWidth 1.8 normal, 2.5 aktiv/wichtig.

---

## 8. Dateistruktur

```
standlomat-saas/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← Auth-Guard + NavClient
│   │   ├── dashboard/
│   │   │   ├── page.tsx        ← Server: lädt alle Daten
│   │   │   └── DashboardClient.tsx  ← Client: Hero KPIs, Machine Grid, Alerts
│   │   ├── machines/
│   │   │   ├── page.tsx
│   │   │   ├── MachinesClient.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── locations/page.tsx
│   │   ├── simulator/
│   │   │   ├── page.tsx        ← Server: lädt Fleet-Daten
│   │   │   └── SimulatorClient.tsx  ← Client: WE/Umsatz/Kosten Slider
│   │   └── settings/page.tsx   ← Client: 28 Kostenpositionen, WE-Rate
│   ├── globals.css             ← Design-System + Mobile Responsive
│   └── layout.tsx              ← Root Layout
├── components/
│   ├── NavClient.tsx           ← Sidebar + Mobile Hamburger
│   ├── MachineCard.tsx         ← Karte mit Inline-Edit, Delete, WE-Override
│   ├── SnapshotModal.tsx       ← Monat/Jahr-Picker für Snapshots
│   ├── CSVImport.tsx           ← Fuzzy-Match CSV → Maschinen
│   ├── Sparkline.tsx           ← SVG Trendlinie
│   ├── ChartsSection.tsx       ← Charts (Snapshot-Verlauf)
│   └── AIPanel.tsx             ← AI-Insights Panel
├── lib/
│   ├── calculations.ts         ← ALLE Business-Logic (pure functions)
│   ├── types.ts                ← TypeScript Interfaces
│   └── supabase/
│       ├── client.ts           ← Browser-Client
│       └── server.ts           ← Server-Client (cookies)
├── middleware.ts               ← Route Protection
├── next.config.js              ← ignoreBuildErrors: true (Supabase TS-Inferenz)
└── .env.local                  ← Supabase Keys
```

---

## 9. Standard-Pattern: Server Page → Client Component

```typescript
// app/(dashboard)/beispiel/page.tsx — SERVER
export default async function BeispielPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('account_id').eq('id', user.id).single()
  const accountId = profile.account_id

  // Alle Fetches parallel
  const [machinesRes, settingsRes] = await Promise.all([
    supabase.from('machines').select('*').eq('account_id', accountId).order('sort_order'),
    supabase.from('fleet_settings').select('*').eq('account_id', accountId).single(),
  ])

  return <BeispielClient machines={machinesRes.data ?? []} />
}

// components/BeispielClient.tsx — CLIENT
'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export default function BeispielClient({ machines }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function refresh() { startTransition(() => router.refresh()) }
  // Nach Mutations: refresh() aufrufen statt State manuell updaten
}
```

---

## 10. MachineCard — Wichtige Details

`components/MachineCard.tsx` hat zwei Render-States:
- **Normal:** KPI-Anzeige mit Status-Border (grün/gelb/rot), Sparkline, DB1/Margin
- **Editing:** Inline-Form mit allen Feldern

**Beim Speichern (handleSave):**
```typescript
// machines → UPDATE
// machine_costs → UPSERT onConflict: 'machine_id' (oder DELETE wenn fix_cost=0)
// we_overrides → UPSERT onConflict: 'machine_id' (oder DELETE wenn kein Override)
// dann router.refresh()
```

**WE-Override:** ★-Symbol neben KPI wenn Maschine eigene WE-Rate hat.

---

## 11. Settings-Seite — Kostenstruktur

28 Kostenpositionen (f1–f28) in 8 Gruppen:
- Leasing (f1–f5, f11–f13)
- Miete Standorte (f6, f14–f16)
- Versicherung (f7)
- Energie (f8, f17, f26)
- Personal (f9a, f9b, f18)
- Software & IT (f19–f21, f25)
- Wartung & Betrieb (f22–f24)
- Sonstiges (f27, f28)

`totalFix` wird live aus allen Positionen summiert und als `total_fix` in `fleet_settings` gespeichert. Zusätzlich `cost_items` als JSONB für Einzelwerte.

---

## 12. Simulator (`/simulator`)

`SimulatorClient.tsx` — vollständig clientseitig, keine DB-Calls.

**4 Regler:**
1. WE-Rate (18–52%) — größter Hebel
2. Umsatz-Wachstum (−30% bis +50%)
3. Fixkosten-Änderung (−40% bis +30%)
4. Neue Maschinen (0–8, rechnet mit Ø-Umsatz)

**Zeigt:** IST vs. SIMULIERT, Delta €/Monat, Delta €/Jahr, 5 Preset-Szenarien.

---

## 13. Mobile Responsive

Ab 640px: Sidebar wird `position: fixed !important` (außerhalb des Flows), Mobile-Topbar erscheint (`display: flex !important`).

**NavClient** hat `useState(mobileOpen)` — Hamburger togglet `.sidebar-desktop.mobile-open` Klasse.

**Wichtig:** `.page-pad` Klasse auf jeden Seiten-Wrapper → wird auf Mobile zu `padding: 16px !important`.

---

## 14. Was als nächstes geplant ist

**Nächste Prioritäten (Reihenfolge):**

### Prio 1: Daily Briefing Page (`/briefing`)
Der stärkste emotionale Hook für den GF. Öffnet morgens das Handy und sieht:
- Gewinn gestern / Monat
- Kritische Standorte
- Top-Empfehlung des Tages
- Kapitalbindung / Break-Even-Status
Eigenständige Page, nicht Widget. Wie eine Zeitung für den Betrieb.

### Prio 2: Machine Detail Page (`/machines/[id]`)
Einzelne Maschine tief analysiert:
- Snapshot-Verlauf als Chart
- DB1/Gewinn-Kurve
- Alle Snapshots als Tabelle
- Empfehlungen spezifisch für diese Maschine

### Prio 3: Snapshot-Vergleich (Dashboard)
Monat-über-Monat Vergleich: aktuell vs. letzter Snapshot vs. Vorjahr.

### Prio 4: Landingpage / Demo-Daten
Für Akquise: öffentliche Landingpage + Demo-Account mit realistischen Testdaten.

---

## 15. Wichtige Regeln (nicht brechen)

1. **Keine hardcodierten Farben** — immer `var(--teal)` etc.
2. **Keine neuen CSS-Klassen** ohne Eintrag in `globals.css`
3. **Keine direkten `baseline_rev` Zugriffe** — immer `getMRev(m)`
4. **Immer `router.refresh()` nach Mutations** — kein manueller State-Sync
5. **TypeScript ignoreBuildErrors** ist aktiviert — trotzdem sauber typen
6. **lucide-react** — kein anderes Icon-System
7. **Server Components für Datenfetch** — nie `useEffect` + fetch in Client
8. **UPSERT mit `onConflict`** bei `machine_costs` und `we_overrides` (haben UNIQUE constraints)
9. **Supabase RLS** — User sieht nur eigene account_id Daten, nie ohne Filter fetchen
10. **Mobile-first denken** — `.page-pad`, `.machine-grid`, `.kpi-grid` Klassen nutzen

---

## 16. Bekannte Testdaten

**Account für Andrej (Owner):** `c0401b2c-4f1e-4df7-bd7d-0783f2681ac0`

Reale Flottenwerte (Andrej):
- Fleet-Umsatz: ~€ 47.000 / Monat
- WE-Rate: 35%
- Fixkosten: € 13.671 / Monat
- 20+ Maschinen in Ferlach, Althofen, Gänserndorf, Klagenfurt u.a.

---

## 17. Dev-Start

```bash
cd standlomat-saas
npm run dev
# → http://localhost:3000
```

Build-Check (TS-Fehler werden ignoriert, trotzdem nützlich für Logik-Fehler):
```bash
npx tsc --noEmit 2>&1 | grep -v "error TS2339\|error TS2698\|error TS2353"
```

Supabase Studio:
```
https://supabase.com/dashboard/project/bdlokeizgaylgtcwgdfw
```
