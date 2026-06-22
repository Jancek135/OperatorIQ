// =============================================================
// Standlomat Intelligence â€” Business Logic
// Ported 1:1 from standlomat_intelligence.html
// All functions are pure (no side effects, no DOM)
// =============================================================

import type { Machine, Snapshot, FleetSettings, MachineStatus, Insight, Alert } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// MONTH LABEL SORT HELPER
// Converts "Feb 2026" / "Mär 2026" etc. to a numeric sort key (YYYYMM)
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_ORDER: Record<string, number> = {
  Jan:1, Feb:2, 'Mär':3, Apr:4, Mai:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Okt:10, Nov:11, Dez:12,
}
function monthLabelKey(label: string): number {
  const [mon, year] = label.split(' ')
  return (parseInt(year) || 0) * 100 + (MONTH_ORDER[mon] ?? 0)
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DYNAMIC REVENUE HELPERS
// Override-Schicht: CSV-Import schlÃ¤gt Baseline
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getMRev(m: Machine): number {
  return m.rev_override ?? m.baseline_rev
}

export function getMTx(m: Machine): number {
  return m.tx_override ?? m.baseline_tx
}

export function getFleetRev(machines: Machine[]): number {
  return machines.reduce((s, m) => s + getMRev(m), 0)
}

export function getFleetTx(machines: Machine[]): number {
  return machines.reduce((s, m) => s + getMTx(m), 0)
}

export function getAvgRev(machines: Machine[]): number {
  return machines.length > 0 ? getFleetRev(machines) / machines.length : 0
}

export function getAvgBon(machines: Machine[]): number {
  const tx = getFleetTx(machines)
  return tx > 0 ? getFleetRev(machines) / tx : 0
}

export function getMWE(m: Machine, defaultWE: number): number {
  return m.we_rate_override ?? defaultWE
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STATUS â€” g(rÃ¼n) / y(elb) / r(ot)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function status(m: Machine, machines: Machine[], settings: FleetSettings): MachineStatus {
  const we   = getMWE(m, settings.we_rate)
  const rev  = getMRev(m)
  const tx   = getMTx(m)
  const bon  = tx > 0 ? rev / tx : 0
  const fixCost = (m.fix_cost ?? 0) + m.miete
  const db1  = rev * (1 - we)

  if (fixCost > 0) {
    const margin = rev > 0 ? (db1 - fixCost) / rev : -1
    if (margin > 0.15) return 'g'
    if (margin >= 0)   return 'y'
    return 'r'
  }

  const avgRev = getAvgRev(machines)
  const avgBon = getAvgBon(machines)
  if (rev >= avgRev * 1.2 && bon >= avgBon)     return 'g'
  if (rev < avgRev * 0.45 || bon < avgBon * 0.65) return 'r'
  return 'y'
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SCORE (0â€“100) â€” fÃ¼r Ranking
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function calcScore(m: Machine, machines: Machine[], settings: FleetSettings): number {
  const avgRev = getAvgRev(machines)
  const avgBon = getAvgBon(machines)
  const rev    = getMRev(m)
  const tx     = getMTx(m)
  const bon    = tx > 0 ? rev / tx : 0
  const revS   = Math.min(100, (rev / (avgRev * 2 || 1)) * 60)
  const bonS   = Math.min(40, (bon / (avgBon * 2 || 1)) * 40)
  return revS + bonS
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RECOMMENDATION â€” kurzer Handlungshinweis pro Maschine
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function rec(m: Machine, machines: Machine[], settings: FleetSettings): string {
  const st     = status(m, machines, settings)
  const rev    = getMRev(m)
  const tx     = getMTx(m)
  const bon    = tx > 0 ? rev / tx : 0
  const avgBon = getAvgBon(machines)
  const avgRev = getAvgRev(machines)

  if (st === 'r') {
    if (bon < avgBon * 0.65) return 'Sortiment prÃ¼fen â€” Bon weit unter Schnitt'
    if (rev < avgRev * 0.3)  return 'Kritisch niedrig â€” Standort hinterfragen'
    return 'Umsatz unter kritischer Schwelle â€” SofortmaÃŸnahme'
  }
  if (st === 'y') {
    if (bon < avgBon)        return 'Sortiment optimieren fÃ¼r hÃ¶heren Bon'
    if (rev < avgRev)        return 'Frequenz steigern oder Standort Ã¼berprÃ¼fen'
    return 'Stabil â€” Potenzial noch nicht ausgeschÃ¶pft'
  }
  return 'Top-Performer â€” Status halten'
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SPARKLINE DATA â€” Punkte fÃ¼r SVG (Ã¤ltester â†’ neuester â†’ aktuell)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SparklineData {
  points: string       // SVG polyline points
  color: string        // CSS color var
  dotCx: string
  dotCy: string
  hasData: boolean
}

export function sparklineData(
  m: Machine,
  snapshots: Snapshot[]
): SparklineData {
  const machineSnaps = snapshots
    .filter(s => s.machine_id === m.id)
    .sort((a, b) => monthLabelKey(a.month_label) - monthLabelKey(b.month_label)) // oldest first

  const currentRev = getMRev(m)

  if (machineSnaps.length === 0) {
    return { points: '', color: 'var(--blue)', dotCx: '0', dotCy: '0', hasData: false }
  }

  const vals = [...machineSnaps.map(s => s.rev), currentRev]

  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const range = max - min || 1

  const W = 54, H = 20, pad = 2

  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const last = vals[vals.length - 1]
  const prev = vals[vals.length - 2]
  const col = last > prev * 1.005
    ? 'var(--green)'
    : last < prev * 0.995
    ? 'var(--red)'
    : 'var(--yellow)'

  const cx = (pad + (W - pad * 2)).toFixed(1)
  const cy = (H - pad - ((last - min) / range) * (H - pad * 2)).toFixed(1)

  return { points: pts, color: col, dotCx: cx, dotCy: cy, hasData: true }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// INSIGHTS â€” strategische Fleet-Beobachtungen
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function buildInsights(machines: Machine[], settings: FleetSettings): Insight[] {
  const insights: Insight[] = []
  const sorted = [...machines].sort((a, b) => getMRev(b) - getMRev(a))
  const top3   = sorted.slice(0, 3)
  const fleetRev = getFleetRev(machines)

  if (machines.length === 0) return insights

  // Top 3 Konzentration
  const top3rev = top3.reduce((s, m) => s + getMRev(m), 0)
  const top3pct = fleetRev > 0 ? (top3rev / fleetRev) * 100 : 0
  if (top3pct > 55) {
    insights.push({
      icon: 'âš ï¸',
      text: `Top-3 Maschinen erwirtschaften ${top3pct.toFixed(0)}% des Umsatzes â€” Klumpenrisiko`,
      type: 'warning'
    })
  }

  // Rote Maschinen
  const red = machines.filter(m => status(m, machines, settings) === 'r')
  if (red.length > 0) {
    insights.push({
      icon: 'ðŸ”´',
      text: `${red.length} Maschine${red.length > 1 ? 'n' : ''} unter kritischer Schwelle: ${red.map(m => m.name).join(', ')}`,
      type: 'warning'
    })
  }

  // Bester Standort
  const byLocation: Record<string, number> = {}
  machines.forEach(m => {
    byLocation[m.standort] = (byLocation[m.standort] ?? 0) + getMRev(m)
  })
  const bestLoc = Object.entries(byLocation).sort((a, b) => b[1] - a[1])[0]
  if (bestLoc) {
    insights.push({
      icon: 'ðŸ“',
      text: `Bester Standort: ${bestLoc[0]} mit â‚¬${bestLoc[1].toLocaleString('de-AT', { maximumFractionDigits: 0 })}`,
      type: 'positive'
    })
  }

  // Bon-Analyse
  const avgBon = getAvgBon(machines)
  const highBon = machines.filter(m => {
    const tx = getMTx(m)
    return tx > 0 && getMRev(m) / tx > avgBon * 1.3
  })
  if (highBon.length > 0) {
    insights.push({
      icon: 'ðŸ’¡',
      text: `${highBon.length} Maschine${highBon.length > 1 ? 'n' : ''} mit Ã¼berdurchschnittlichem Bon â€” Sortiment als Vorbild nehmen`,
      type: 'positive'
    })
  }

  // WE-Druck
  const avgRev = getAvgRev(machines)
  const weRate = settings.we_rate
  if (weRate > 0.3) {
    insights.push({
      icon: 'ðŸ“¦',
      text: `Wareneinsatz ${(weRate * 100).toFixed(0)}% â€” Ã¼ber 30% drÃ¼ckt Marge erheblich`,
      type: 'warning'
    })
  }

  // GrÃ¼ne Performer
  const green = machines.filter(m => status(m, machines, settings) === 'g')
  if (green.length > 0) {
    insights.push({
      icon: 'âœ…',
      text: `${green.length} Maschine${green.length > 1 ? 'n' : ''} im grÃ¼nen Bereich â€” Fleet-Anteil ${((green.length / machines.length) * 100).toFixed(0)}%`,
      type: 'positive'
    })
  }

  return insights.slice(0, 5)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ALERTS â€” konkrete Warnungen pro Maschine
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function buildAlerts(machines: Machine[], settings: FleetSettings): Alert[] {
  const alerts: Alert[] = []
  const avgRev = getAvgRev(machines)
  const avgBon = getAvgBon(machines)

  machines.forEach(m => {
    const rev = getMRev(m)
    const tx  = getMTx(m)
    const bon = tx > 0 ? rev / tx : 0
    const we  = getMWE(m, settings.we_rate)
    const fixCost = (m.fix_cost ?? 0) + m.miete
    const db1 = rev * (1 - we)

    if (fixCost > 0 && db1 < fixCost) {
      alerts.push({
        icon: 'ðŸ”´',
        text: `DB1 (â‚¬${db1.toFixed(0)}) deckt Fixkosten (â‚¬${fixCost.toFixed(0)}) nicht`,
        machine: m.name,
        severity: 'r'
      })
    } else if (rev < avgRev * 0.45) {
      alerts.push({
        icon: 'ðŸ”´',
        text: `Umsatz â‚¬${rev.toFixed(0)} â€” nur ${((rev / avgRev) * 100).toFixed(0)}% des Fleet-Schnitts`,
        machine: m.name,
        severity: 'r'
      })
    } else if (bon < avgBon * 0.65 && tx > 10) {
      alerts.push({
        icon: 'ðŸŸ¡',
        text: `Bon â‚¬${bon.toFixed(2)} â€” ${((bon / avgBon) * 100).toFixed(0)}% des Schnitts`,
        machine: m.name,
        severity: 'y'
      })
    } else if (rev < avgRev * 0.7) {
      alerts.push({
        icon: 'ðŸŸ¡',
        text: `Umsatz unter 70% des Fleet-Schnitts`,
        machine: m.name,
        severity: 'y'
      })
    }
  })

  return alerts.sort((a, b) => (a.severity === 'r' ? -1 : 1))
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PROFIT CALCULATION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function calcProfit(machines: Machine[], settings: FleetSettings): number {
  const fleetRev = getFleetRev(machines)
  const we = settings.we_rate
  const totalCosts = settings.total_fix + settings.variable_costs
  return fleetRev * (1 - we) - totalCosts
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CSV FUZZY MATCHING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function tokenize(name: string): string[] {
  return name.toLowerCase().split(/[\s\-_\/\\]+/).filter(t => t.length > 2)
}

export function fuzzyMatch(csvName: string, machines: Machine[]): Machine | null {
  let best: Machine | null = null
  let bestScore = 0

  const csvTokens = tokenize(csvName)

  machines.forEach(m => {
    const mTokens = tokenize(m.name)
    const score = csvTokens.filter(t => mTokens.includes(t)).length
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  })

  return bestScore >= 1 ? best : null
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CSV PARSING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ParsedCSVRow {
  name: string
  rev: number
  tx: number
}

export function parseCSVText(text: string): ParsedCSVRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Auto-detect separator
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/["']/g, ''))

  // Find column indices
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('bezeichnung') || h.includes('maschine') || h.includes('gerÃ¤t'))
  const revIdx  = headers.findIndex(h => h.includes('umsatz') || h.includes('revenue') || h.includes('betrag') || h.includes('summe') || h.includes('erlÃ¶s'))
  const txIdx   = headers.findIndex(h => h.includes('transaktion') || h.includes('verkauf') || h.includes('anzahl') || h.includes('count') || h.includes('vend'))

  if (nameIdx < 0 || revIdx < 0) return []

  return lines.slice(1).map(line => {
    const cols = line.split(sep).map(c => c.trim().replace(/["']/g, ''))
    const name = cols[nameIdx] ?? ''
    const rev  = parseFloat((cols[revIdx] ?? '0').replace(',', '.')) || 0
    const tx   = txIdx >= 0 ? parseInt(cols[txIdx] ?? '0') || 0 : 0
    return { name, rev, tx }
  }).filter(r => r.name && r.rev > 0)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AI INSIGHTS â€” specific, data-driven, actionable
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type AIInsightType = 'opportunity' | 'warning' | 'critical' | 'positive'

export interface AIInsight {
  type: AIInsightType
  icon: string
  title: string
  detail: string
  action: string
  potential: number | null   // â‚¬/Monat, positive = gain
  machine?: string
}

export function buildAIInsights(machines: Machine[], settings: FleetSettings): AIInsight[] {
  if (machines.length < 2) return []
  const insights: AIInsight[] = []
  const avgRev  = getAvgRev(machines)
  const avgBon  = getAvgBon(machines)
  const fleetRev = getFleetRev(machines)
  const sorted  = [...machines].sort((a, b) => getMRev(b) - getMRev(a))
  const we = settings.we_rate

  // 1. Worst underperformer
  const worst = [...machines].sort((a, b) => getMRev(a) - getMRev(b))[0]
  const worstRev = getMRev(worst)
  const worstPct = avgRev > 0 ? ((avgRev - worstRev) / avgRev) * 100 : 0
  if (worstPct > 30) {
    const potential = Math.round((avgRev - worstRev) * (1 - we))
    insights.push({
      type: 'critical',
      icon: 'ðŸ“',
      title: `${worst.name} liegt ${worstPct.toFixed(0)}% unter dem Durchschnitt`,
      detail: `Umsatz: â‚¬ ${worstRev.toLocaleString('de-AT', { maximumFractionDigits: 0 })} vs. Fleet-Schnitt â‚¬ ${avgRev.toLocaleString('de-AT', { maximumFractionDigits: 0 })}. Standort oder Sortiment Ã¼berprÃ¼fen.`,
      action: 'Standort analysieren oder Maschine versetzen',
      potential,
      machine: worst.name,
    })
  }

  // 2. Low-bon machine
  const lowBon = machines
    .filter(m => { const tx = getMTx(m); return tx > 5 && getMRev(m) / tx < avgBon * 0.65 })
    .sort((a, b) => (getMRev(a) / Math.max(getMTx(a),1)) - (getMRev(b) / Math.max(getMTx(b),1)))[0]
  if (lowBon) {
    const tx = getMTx(lowBon)
    const bon = tx > 0 ? getMRev(lowBon) / tx : 0
    const bonGap = avgBon - bon
    const potential = Math.round(tx * bonGap * (1 - we))
    insights.push({
      type: 'opportunity',
      icon: 'ðŸ›’',
      title: `${lowBon.name}: Bon ${((bon / avgBon) * 100).toFixed(0)}% unter Schnitt`,
      detail: `Ã˜ Bon â‚¬ ${bon.toFixed(2)} vs. Fleet-Schnitt â‚¬ ${avgBon.toFixed(2)}. ${tx} Transaktionen/Monat â€” kleines Sortiment-Update wirkt sofort.`,
      action: 'Sortiment anpassen â€” hochmargige Artikel hinzufÃ¼gen',
      potential,
      machine: lowBon.name,
    })
  }

  // 3. Top performer â€” best location
  const byLocation: Record<string, number> = {}
  machines.forEach(m => { byLocation[m.standort] = (byLocation[m.standort] ?? 0) + getMRev(m) })
  const topLoc = Object.entries(byLocation).sort((a, b) => b[1] - a[1])[0]
  if (topLoc) {
    const share = fleetRev > 0 ? (topLoc[1] / fleetRev) * 100 : 0
    const locMachines = machines.filter(m => m.standort === topLoc[0])
    insights.push({
      type: 'positive',
      icon: 'â­',
      title: `${topLoc[0]} ist dein stÃ¤rkster Standort`,
      detail: `${share.toFixed(0)}% der Fleet-Revenue mit ${locMachines.length} Maschine${locMachines.length > 1 ? 'n' : ''}. Dieses Standort-Modell auf neue Locations Ã¼bertragen.`,
      action: 'Erfolgsformel auf Ã¤hnliche Standorte replizieren',
      potential: null,
    })
  }

  // 4. WE optimization
  if (we > 0.30) {
    const potentialWE = Math.round(fleetRev * (we - 0.28))
    insights.push({
      type: 'opportunity',
      icon: 'ðŸ“¦',
      title: `WE ${(we * 100).toFixed(0)}% â€” Einkauf optimierbar`,
      detail: `Reduktion auf 28% wÃ¼rde den Monatsproffit um ca. â‚¬ ${potentialWE.toLocaleString('de-AT', { maximumFractionDigits: 0 })} steigern. Lieferantenverhandlung oder Produktmix anpassen.`,
      action: 'WE-Satz auf 28% verhandeln',
      potential: potentialWE,
    })
  }

  // 5. Revenue concentration risk
  const top3Rev = sorted.slice(0, 3).reduce((s, m) => s + getMRev(m), 0)
  const concentration = fleetRev > 0 ? (top3Rev / fleetRev) * 100 : 0
  if (concentration > 60 && machines.length >= 5) {
    insights.push({
      type: 'warning',
      icon: 'âš ï¸',
      title: `Klumpenrisiko: Top 3 = ${concentration.toFixed(0)}% des Umsatzes`,
      detail: `${sorted[0].name}, ${sorted[1]?.name ?? ''} und ${sorted[2]?.name ?? ''} tragen ${concentration.toFixed(0)}% der Fleet-Revenue. Ausfall einer Maschine wÃ¼rde stark schmerzen.`,
      action: 'Fleet diversifizieren â€” neue Standorte erschlieÃŸen',
      potential: null,
    })
  }

  // 6. Best machine vs worst â€” replacement signal
  const best = sorted[0]
  if (best && worst && getMRev(best) > getMRev(worst) * 5) {
    const potential = Math.round((getMRev(best) * 0.5 - getMRev(worst)) * (1 - we))
    if (potential > 200) {
      insights.push({
        type: 'opportunity',
        icon: 'ðŸ”„',
        title: `${worst.name} kÃ¶nnte ersetzt werden`,
        detail: `Ertrag ${(getMRev(worst) / getMRev(best) * 100).toFixed(0)}% von ${best.name}. Versetzung an einen besseren Standort oder Ausstausch gegen stÃ¤rkeres Modell.`,
        action: 'Maschine versetzen oder gegen Top-Modell tauschen',
        potential,
        machine: worst.name,
      })
    }
  }

  return insights.slice(0, 5)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FLEET HEALTH SCORE (0â€“100)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function calcFleetHealth(machines: Machine[], settings: FleetSettings): number {
  if (machines.length === 0) return 0
  const g = machines.filter(m => status(m, machines, settings) === 'g').length
  const y = machines.filter(m => status(m, machines, settings) === 'y').length
  const r = machines.filter(m => status(m, machines, settings) === 'r').length
  const base = (g * 1.0 + y * 0.6 + r * 0.2) / machines.length * 80
  const profit = calcProfit(machines, settings)
  const profitBonus = profit > 0 ? 12 : profit > -1000 ? 4 : -8
  const weBonus = settings.we_rate > 0.35 ? -8 : settings.we_rate > 0.3 ? -4 : 0
  return Math.round(Math.max(10, Math.min(98, base + profitBonus + weBonus)))
}

export function calcAIScore(machines: Machine[], snapshots: Snapshot[], settings: FleetSettings): number {
  const health = calcFleetHealth(machines, settings)
  const hasSnapshots = snapshots.length > 0 ? 4 : -6
  const hasCosts = machines.some(m => (m.fix_cost ?? 0) > 0) ? 3 : -3
  const locationCount = new Set(machines.map(m => m.standort)).size
  const diversity = locationCount > 2 ? 3 : locationCount > 1 ? 1 : -2
  return Math.round(Math.max(10, Math.min(98, health + hasSnapshots + hasCosts + diversity - 6)))
}

// Returns relative change for a single machine vs. its latest snapshot (null if no data)
export function calcMachineTrend(m: Machine, snapshots: Snapshot[]): { rev: number | null; tx: number | null } {
  const machineSnaps = snapshots
    .filter(s => s.machine_id === m.id)
    .sort((a, b) => monthLabelKey(b.month_label) - monthLabelKey(a.month_label))
  if (machineSnaps.length === 0) return { rev: null, tx: null }
  const prev = machineSnaps[0]
  const currRev = getMRev(m)
  const currTx  = getMTx(m)
  return {
    rev: prev.rev > 0 ? (currRev - prev.rev) / prev.rev : null,
    tx:  prev.tx  > 0 ? (currTx  - prev.tx)  / prev.tx  : null,
  }
}

// Returns relative change vs. latest snapshot month (null if no snapshots)
export function calcFleetTrend(machines: Machine[], snapshots: Snapshot[]): number | null {
  if (snapshots.length === 0) return null
  const labels = [...new Set(snapshots.map(s => s.month_label))].sort((a, b) => monthLabelKey(a) - monthLabelKey(b))
  const lastLabel = labels[labels.length - 1]
  const lastRev = snapshots.filter(s => s.month_label === lastLabel).reduce((sum, s) => sum + s.rev, 0)
  if (lastRev === 0) return null
  return (getFleetRev(machines) - lastRev) / lastRev
}

export function calcProfitTrend(machines: Machine[], snapshots: Snapshot[], settings: FleetSettings): number | null {
  if (snapshots.length === 0) return null
  const labels = [...new Set(snapshots.map(s => s.month_label))].sort((a, b) => monthLabelKey(a) - monthLabelKey(b))
  const lastLabel = labels[labels.length - 1]
  const lastRev = snapshots.filter(s => s.month_label === lastLabel).reduce((sum, s) => sum + s.rev, 0)
  const lastProfit = lastRev * (1 - settings.we_rate) - (settings.total_fix + settings.variable_costs)
  const currProfit = calcProfit(machines, settings)
  if (lastProfit === 0) return null
  return (currProfit - lastProfit) / Math.abs(lastProfit)
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FORMATTING HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function fmtEur(n: number): string {
  return 'â‚¬â€¯' + n.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtEur2(n: number): string {
  return 'â‚¬â€¯' + n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}



