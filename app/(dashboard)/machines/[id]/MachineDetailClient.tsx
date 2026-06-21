'use client'

import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import {
  getMRev, getMTx, getMWE,
  status, rec, calcScore,
  getAvgRev, getAvgBon,
  fmtEur, fmtEur2, fmtPct,
  buildAIInsights,
} from '@/lib/calculations'
import {
  ArrowLeft, MapPin, TrendingUp, TrendingDown,
  Cpu, Coffee, ShoppingBag, Zap,
  BarChart2, DollarSign, Package, AlertTriangle, CheckCircle,
  Building2, ChevronRight, Brain, Lightbulb, XCircle,
} from 'lucide-react'

interface Props {
  machine: Machine
  machines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
}

function MachineTypeIcon({ name }: { name: string }) {
  const n = name.toLowerCase()
  if (n.includes('coffee') || n.includes('kaffee')) return <Coffee size={16} />
  if (n.includes('snack') || n.includes('candy'))   return <ShoppingBag size={16} />
  if (n.includes('shake') || n.includes('energy'))  return <Zap size={16} />
  return <Cpu size={16} />
}

const STATUS_LABEL: Record<string, string> = { g: 'TOP PERFORMER', y: 'NORMALBETRIEB', r: 'KRITISCH' }
const STATUS_COLOR: Record<string, string> = {
  g: 'var(--green)', y: 'var(--yellow)', r: 'var(--red)',
}
const STATUS_BG: Record<string, string> = {
  g: 'rgba(52,211,153,0.09)', y: 'rgba(251,191,36,0.09)', r: 'rgba(248,113,113,0.09)',
}
const STATUS_BORDER: Record<string, string> = {
  g: 'rgba(52,211,153,0.20)', y: 'rgba(251,191,36,0.16)', r: 'rgba(248,113,113,0.22)',
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--s1)', border: '1px solid rgba(56,189,248,0.16)',
      borderRadius: '10px', padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontSize: '12px',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: '6px', fontWeight: 700 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {p.dataKey === 'tx' ? p.value : `€ ${p.value.toLocaleString('de-AT')}`}
        </div>
      ))}
    </div>
  )
}

export default function MachineDetailClient({ machine: m, machines, snapshots, settings }: Props) {
  const st      = status(m, machines, settings)
  const rev     = getMRev(m)
  const tx      = getMTx(m)
  const bon     = tx > 0 ? rev / tx : 0
  const we      = getMWE(m, settings.we_rate)
  const db1     = rev * (1 - we)
  const fixCost = (m.fix_cost ?? 0) + m.miete
  const margin  = fixCost > 0 && rev > 0 ? ((db1 - fixCost) / rev) * 100 : null
  const avgRev  = getAvgRev(machines)
  const avgBon  = getAvgBon(machines)
  const score   = calcScore(m, machines, settings)
  const revPct  = avgRev > 0 ? (rev / avgRev) * 100 : 0
  const rank    = [...machines].sort((a, b) => getMRev(b) - getMRev(a)).findIndex(x => x.id === m.id) + 1

  // Build chart data from snapshots for this machine
  const machineSnaps = snapshots
    .filter(s => s.machine_id === m.id)
    .sort((a, b) => a.month_label.localeCompare(b.month_label))

  const chartData = machineSnaps.map(s => ({
    month: s.month_label.split(' ')[0].slice(0, 3),
    rev:   Math.round(s.rev),
    tx:    s.tx,
    bon:   s.tx > 0 ? parseFloat((s.rev / s.tx).toFixed(2)) : 0,
  }))

  // Add current month
  const nowLabel = new Date().toLocaleDateString('de-AT', { month: 'short' })
  chartData.push({ month: nowLabel, rev: Math.round(rev), tx, bon: parseFloat(bon.toFixed(2)) })

  const hasHistory = machineSnaps.length > 0

  // Build snapshot table (newest first)
  const tableRows = [...machineSnaps]
    .sort((a, b) => b.month_label.localeCompare(a.month_label))
    .map((s, i, arr) => {
      const prev = arr[i + 1]
      const revDelta = prev ? ((s.rev - prev.rev) / prev.rev) * 100 : null
      return { ...s, revDelta }
    })

  const stColor  = STATUS_COLOR[st]
  const stBg     = STATUS_BG[st]
  const stBorder = STATUS_BORDER[st]

  // Standort: other machines at the same location
  const sameStandort = machines.filter(x => x.id !== m.id && x.standort === m.standort)
  const standortAll  = [m, ...sameStandort]
  const standortRev  = standortAll.reduce((s, x) => s + getMRev(x), 0)
  const standortTx   = standortAll.reduce((s, x) => s + getMTx(x), 0)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 0 40px' }}>

      {/* ── Back + Header ── */}
      <div style={{ marginBottom: '28px' }}>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          color: 'var(--muted)', fontSize: '12px', fontWeight: 600,
          textDecoration: 'none', marginBottom: '20px',
          padding: '6px 12px',
          background: 'var(--s1)', border: '1px solid var(--border)',
          borderRadius: '8px',
          transition: 'color .15s',
        }}>
          <ArrowLeft size={14} />
          Zurück zum Dashboard
        </Link>

        <div style={{
          background: 'var(--s2)',
          border: `1px solid ${stBorder}`,
          borderRadius: 'var(--r-xl)',
          padding: '24px 28px',
          boxShadow: `0 0 40px rgba(0,0,0,0.4), 0 0 20px ${stColor}0a`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
              background: stBg, border: `1px solid ${stBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: stColor,
            }}>
              <MachineTypeIcon name={m.name} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px' }}>{m.name}</h1>
                <span style={{
                  fontSize: '10px', fontWeight: 800, letterSpacing: '.7px',
                  background: stBg, color: stColor, border: `1px solid ${stBorder}`,
                  borderRadius: '99px', padding: '3px 10px',
                }}>
                  {STATUS_LABEL[st]}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--muted)', fontSize: '13px' }}>
                  <MapPin size={13} />
                  {m.standort}
                </span>
                <span style={{
                  fontSize: '11px', color: 'var(--muted)',
                  background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '2px 8px',
                }}>
                  Rang #{rank}
                </span>
              </div>
            </div>
          </div>

          {/* Score */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '4px' }}>
              MACHINE SCORE
            </div>
            <div style={{ fontSize: '38px', fontWeight: 900, color: stColor, letterSpacing: '-2px', lineHeight: 1 }}>
              {score.toFixed(0)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>von 100</div>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <KpiCard label="UMSATZ" value={fmtEur(rev)} sub={`${revPct.toFixed(0)}% vom Schnitt`} color="var(--teal)" icon={<DollarSign size={15} />} />
        <KpiCard label="TRANSAKTIONEN" value={tx.toString()} sub="Käufe / Monat" color="var(--text)" icon={<BarChart2 size={15} />} />
        <KpiCard label="Ø BON" value={fmtEur2(bon)} sub={`Schnitt: ${fmtEur2(avgBon)}`} color={bon >= avgBon ? 'var(--green)' : 'var(--yellow)'} icon={<Package size={15} />} />
        <KpiCard label="DB1" value={fmtEur(db1)} sub={`WE ${fmtPct(we)}`} color={db1 > fixCost ? 'var(--green)' : 'var(--red)'} icon={fixCost > 0 ? (db1 > fixCost ? <CheckCircle size={15} /> : <AlertTriangle size={15} />) : null} />
      </div>

      {/* ── Profit-Breakdown ── */}
      <div style={{
        background: 'var(--s2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '22px 24px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '18px' }}>
          PROFIT-BREAKDOWN — WASSERFALL
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Umsatz */}
          <ProfitRow
            label="Umsatz"
            value={rev}
            total={rev}
            color="var(--teal)"
            prefix="+"
          />
          {/* Wareneinsatz */}
          <ProfitRow
            label={`Wareneinsatz (${fmtPct(we)})`}
            value={-(rev * we)}
            total={rev}
            color="var(--yellow)"
            prefix="−"
            sub={`verbleibend: ${fmtEur(db1)}`}
          />
          {/* Divider = DB1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: '1px solid var(--border)', borderBottom: fixCost > 0 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', width: '180px', flexShrink: 0 }}>= Deckungsbeitrag 1</div>
            <div style={{ flex: 1, height: '6px', background: 'var(--s3)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(db1 / rev) * 100}%`, background: 'var(--teal)', borderRadius: '99px' }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--teal)', minWidth: '80px', textAlign: 'right' }}>{fmtEur(db1)}</div>
          </div>
          {/* Fixkosten */}
          {fixCost > 0 && (
            <ProfitRow
              label={`Fixkosten + Miete`}
              value={-fixCost}
              total={rev}
              color="rgba(248,113,113,0.8)"
              prefix="−"
              sub={`Miete ${fmtEur(m.miete)} + Fix ${fmtEur(m.fix_cost ?? 0)}`}
            />
          )}
          {/* Nettogewinn */}
          {fixCost > 0 && (() => {
            const net = db1 - fixCost
            const netColor = net >= 0 ? 'var(--green)' : 'var(--red)'
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', marginTop: '4px',
                borderRadius: 'var(--r-sm)',
                background: net >= 0 ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)',
                border: `1px solid ${net >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: netColor, width: '180px', flexShrink: 0 }}>
                  {net >= 0 ? '✓ Nettogewinn' : '✗ Nettoverlust'}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: '20px', fontWeight: 900, color: netColor }}>
                  {net >= 0 ? '+' : ''}{fmtEur(net)} /Mo
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── Costs + Margin ── */}
      {fixCost > 0 && (
        <div style={{
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '20px 24px', marginBottom: '20px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
        }}>
          <CostItem label="MIETE" value={fmtEur(m.miete)} />
          <CostItem label="FIXKOSTEN" value={fmtEur(m.fix_cost ?? 0)} />
          <CostItem label="GESAMTKOSTEN" value={fmtEur(fixCost)} highlight />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '6px' }}>
              MARGE NACH KOSTEN
            </div>
            <div style={{
              fontSize: '22px', fontWeight: 900,
              color: margin !== null && margin > 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {margin !== null ? `${margin.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: '11px', color: margin !== null && margin > 0 ? 'var(--green)' : 'var(--red)', marginTop: '2px' }}>
              {fmtEur(db1 - fixCost)} /Mo
            </div>
          </div>
        </div>
      )}

      {/* ── Standort ── */}
      <div style={{
        background: 'var(--s2)', border: '1px solid var(--border-card)',
        borderRadius: 'var(--r-lg)', marginBottom: '20px', overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          padding: '18px 24px',
          borderBottom: sameStandort.length > 0 ? '1px solid var(--border)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(56,189,248,0.025) 0%, transparent 60%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)',
              flexShrink: 0,
            }}>
              <Building2 size={15} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '2px' }}>
                STANDORT
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                {m.standort}
              </div>
            </div>
          </div>
          {/* Standort stats */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '2px' }}>STANDORT UMSATZ</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--teal)' }}>{fmtEur(standortRev)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '2px' }}>MASCHINEN</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--label)' }}>{standortAll.length}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '2px' }}>TOTAL TX</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--label)' }}>{standortTx}</div>
            </div>
          </div>
        </div>

        {/* Other machines at same standort */}
        {sameStandort.length > 0 && (
          <div style={{ padding: '6px 24px 14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.6px', margin: '10px 0 8px' }}>
              WEITERE MASCHINEN AN DIESEM STANDORT
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sameStandort.map(x => {
                const xSt    = status(x, machines, settings)
                const xRev   = getMRev(x)
                const xTx    = getMTx(x)
                const xColor = STATUS_COLOR[xSt]
                const xBg    = STATUS_BG[xSt]
                const xBdr   = STATUS_BORDER[xSt]
                return (
                  <a
                    key={x.id}
                    href={`/machines/${x.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: 'var(--s3)', border: `1px solid ${xBdr}`,
                      borderRadius: 'var(--r-sm)', padding: '11px 14px',
                      textDecoration: 'none', color: 'inherit',
                      transition: 'background .15s, transform .14s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--s4)'
                      ;(e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--s3)'
                      ;(e.currentTarget as HTMLElement).style.transform = 'translateX(0)'
                    }}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: xColor, flexShrink: 0,
                      boxShadow: `0 0 6px ${xColor}88`,
                    }} />
                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {x.name}
                      </div>
                    </div>
                    {/* Revenue */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: xColor }}>{fmtEur(xRev)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{xTx} TX</div>
                      </div>
                      <span style={{
                        fontSize: '9px', fontWeight: 800, letterSpacing: '.5px',
                        background: xBg, color: xColor, border: `1px solid ${xBdr}`,
                        borderRadius: '5px', padding: '2px 7px',
                      }}>
                        {STATUS_LABEL[xSt].split(' ')[0]}
                      </span>
                      <ChevronRight size={14} color="var(--muted)" />
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Allein am Standort */}
        {sameStandort.length === 0 && (
          <div style={{ padding: '14px 24px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={13} color="var(--muted)" />
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Einzige Maschine an diesem Standort
            </span>
          </div>
        )}
      </div>

      {/* ── KI-Analyse ── */}
      {(() => {
        const avgRev = getAvgRev(machines)
        const avgBon = getAvgBon(machines)
        const fleetInsights = buildAIInsights(machines, settings)
        const machineInsights = fleetInsights.filter(i => i.machine === m.name)

        // Machine-spezifische Analyse direkt aus Zahlen
        const localInsights: Array<{ icon: string; title: string; detail: string; color: string }> = []

        // Bon-Analyse
        if (bon < avgBon * 0.8 && tx > 3) {
          localInsights.push({
            icon: '🛒',
            title: `Bon ${((bon / avgBon) * 100).toFixed(0)}% unter Flottendurchschnitt`,
            detail: `Ø Bon ${fmtEur2(bon)} vs. Flotte ${fmtEur2(avgBon)}. Hochmargige Artikel im Sortiment sind unterrepräsentiert.`,
            color: 'var(--yellow)',
          })
        } else if (bon > avgBon * 1.15) {
          localInsights.push({
            icon: '⭐',
            title: `Bon ${((bon / avgBon) * 100).toFixed(0)}% über Flottendurchschnitt`,
            detail: `Ø Bon ${fmtEur2(bon)} vs. Flotte ${fmtEur2(avgBon)}. Sortiment und Standort passen gut zusammen.`,
            color: 'var(--green)',
          })
        }

        // Umsatz-Analyse
        if (rev < avgRev * 0.6) {
          localInsights.push({
            icon: '📉',
            title: `Umsatz ${((rev / avgRev) * 100).toFixed(0)}% unter Flottendurchschnitt`,
            detail: `${fmtEur(rev)}/Mo vs. Flottenø ${fmtEur(avgRev)}/Mo. Standortfrequenz oder Sichtbarkeit der Maschine prüfen.`,
            color: 'var(--red)',
          })
        } else if (rev > avgRev * 1.3) {
          localInsights.push({
            icon: '🚀',
            title: `Umsatz ${((rev / avgRev) * 100).toFixed(0)}% über Flottendurchschnitt`,
            detail: `${fmtEur(rev)}/Mo vs. Flottenø ${fmtEur(avgRev)}/Mo. Dieser Standort ist ein Wachstumstreiber.`,
            color: 'var(--green)',
          })
        }

        // WE-Analyse
        const machineWE = getMWE(m, settings.we_rate)
        if (machineWE > settings.we_rate + 0.04) {
          localInsights.push({
            icon: '📦',
            title: `Individueller WE ${fmtPct(machineWE)} über Flotten-WE ${fmtPct(settings.we_rate)}`,
            detail: `Wareneinsatz dieser Maschine überdurchschnittlich hoch. Produktmix oder Lieferantenbedingungen prüfen.`,
            color: 'var(--yellow)',
          })
        }

        // Marge-Analyse
        if (fixCost > 0) {
          const net = db1 - fixCost
          if (net < 0) {
            localInsights.push({
              icon: '🔴',
              title: `Verlust ${fmtEur(Math.abs(net))}/Monat nach allen Kosten`,
              detail: `DB1 ${fmtEur(db1)} deckt die Fixkosten (${fmtEur(fixCost)}) nicht. Umsatz muss um ${fmtEur(fixCost - db1)} steigen um Break-Even zu erreichen.`,
              color: 'var(--red)',
            })
          }
        }

        // Fleet-Insights für diese Maschine
        machineInsights.forEach(i => {
          if (!localInsights.find(l => l.title.includes(m.name))) {
            localInsights.push({
              icon: i.icon,
              title: i.title,
              detail: i.detail,
              color: i.type === 'critical' ? 'var(--red)' : i.type === 'warning' ? 'var(--yellow)' : i.type === 'positive' ? 'var(--green)' : 'var(--teal)',
            })
          }
        })

        if (localInsights.length === 0) return null

        return (
          <div style={{
            background: 'var(--s2)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', marginBottom: '20px', overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'linear-gradient(135deg, rgba(56,189,248,0.03) 0%, transparent 60%)',
            }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', flexShrink: 0 }}>
                <Brain size={14} />
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: 'var(--muted)' }}>KI-ANALYSE</div>
                <div style={{ fontSize: '12px', color: 'var(--label)' }}>{localInsights.length} Erkenntnisse zu dieser Maschine</div>
              </div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {localInsights.slice(0, 4).map((insight, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '14px', alignItems: 'flex-start',
                  padding: '14px 22px',
                  borderBottom: i < Math.min(localInsights.length, 4) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <div style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1, marginTop: '2px' }}>{insight.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: insight.color, marginBottom: '3px' }}>{insight.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>{insight.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

        {/* Revenue history */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '4px' }}>
            UMSATZVERLAUF
          </div>
          <div style={{ fontSize: '12px', color: 'var(--label)', marginBottom: '16px' }}>
            {hasHistory ? `${machineSnaps.length + 1} Monate` : 'Aktueller Monat'}
          </div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="mRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#38bdf8" stopOpacity={0.32} />
                    <stop offset="55%" stopColor="#38bdf8" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#3d5275', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fill: '#3d5275', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="rev" name="Umsatz" stroke="#38bdf8" strokeWidth={2} fill="url(#mRevGrad)"
                  dot={false} activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0c1730', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoHistory />
          )}
        </div>

        {/* TX + Bon history */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '4px' }}>
            TRANSAKTIONEN & BON
          </div>
          <div style={{ fontSize: '12px', color: 'var(--label)', marginBottom: '16px' }}>
            Käufe pro Monat
          </div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="mTxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#34d399" stopOpacity={0.30} />
                    <stop offset="55%" stopColor="#34d399" stopOpacity={0.07} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#3d5275', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fill: '#3d5275', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="tx" name="TX" stroke="#34d399" strokeWidth={2} fill="url(#mTxGrad)"
                  dot={false} activeDot={{ r: 5, fill: '#34d399', stroke: '#0c1730', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoHistory />
          )}
        </div>
      </div>

      {/* ── Snapshot Table ── */}
      {tableRows.length > 0 && (
        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '18px' }}>
            MONATSVERLAUF — SNAPSHOTS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['MONAT', 'UMSATZ', 'TX', 'Ø BON', 'Δ UMSATZ'].map(h => (
                  <th key={h} style={{
                    textAlign: h === 'MONAT' ? 'left' : 'right',
                    fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px',
                    paddingBottom: '12px', borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const rowBon = row.tx > 0 ? row.rev / row.tx : 0
                return (
                  <tr key={row.month_label} style={{ borderBottom: i < tableRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '12px 0', fontSize: '13px', fontWeight: 600 }}>{row.month_label}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>
                      {fmtEur(row.rev)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontSize: '13px', color: 'var(--label)' }}>
                      {row.tx}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontSize: '13px', color: 'var(--label)' }}>
                      {fmtEur2(rowBon)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      {row.revDelta !== null ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '12px', fontWeight: 700,
                          color: row.revDelta >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {row.revDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(row.revDelta).toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Empfehlungs-Box ── */}
      {(() => {
        const avgRev = getAvgRev(machines)
        const avgBon = getAvgBon(machines)
        const net    = db1 - fixCost

        // Konkrete Aktionen basierend auf Daten
        const actions: Array<{ priority: 'hoch' | 'mittel' | 'niedrig'; icon: string; title: string; reason: string }> = []

        if (st === 'r') {
          if (net < 0 && fixCost > 0) {
            actions.push({
              priority: 'hoch',
              icon: '🏠',
              title: 'Standortvertrag neu verhandeln',
              reason: `Verlust ${fmtEur(Math.abs(net))}/Mo. Mietsenkung um ${fmtEur(Math.abs(net))} würde Break-Even erreichen.`,
            })
          }
          if (bon < avgBon * 0.75 && tx > 3) {
            actions.push({
              priority: 'hoch',
              icon: '🛒',
              title: 'Sortiment sofort überarbeiten',
              reason: `Bon ${fmtEur2(bon)} liegt ${(100 - (bon / avgBon) * 100).toFixed(0)}% unter Schnitt. Hochmargige Artikel einführen.`,
            })
          }
          if (rev < avgRev * 0.4) {
            actions.push({
              priority: 'hoch',
              icon: '📍',
              title: 'Standortwechsel prüfen',
              reason: `Umsatz nur ${((rev / avgRev) * 100).toFixed(0)}% des Flottenø. Standortfrequenz möglicherweise zu niedrig.`,
            })
          }
        }

        if (st === 'y') {
          if (bon < avgBon) {
            actions.push({
              priority: 'mittel',
              icon: '🛒',
              title: 'Sortiment optimieren',
              reason: `Bon ${fmtEur2(bon)} unter Flottenø ${fmtEur2(avgBon)}. Margenstärkere Artikel testen.`,
            })
          }
          if (getMWE(m, settings.we_rate) > settings.we_rate + 0.02) {
            actions.push({
              priority: 'mittel',
              icon: '📦',
              title: 'Wareneinsatz neu verhandeln',
              reason: `WE ${fmtPct(getMWE(m, settings.we_rate))} über Flotten-WE ${fmtPct(settings.we_rate)}. Lieferantengespräch einplanen.`,
            })
          }
          actions.push({
            priority: 'niedrig',
            icon: '📈',
            title: 'Frequenz steigern',
            reason: `Umsatzpotenzial noch nicht ausgeschöpft. Marketing am Standort oder Sichtbarkeit der Maschine verbessern.`,
          })
        }

        if (st === 'g') {
          actions.push({
            priority: 'niedrig',
            icon: '⭐',
            title: 'Erfolgsformel replizieren',
            reason: `Top-Performer Rang #${rank}. Sortiment und Standortlogik als Vorlage für neue Maschinen nutzen.`,
          })
          if (bon > avgBon * 1.1) {
            actions.push({
              priority: 'niedrig',
              icon: '🔄',
              title: 'Sortiment auf andere Standorte übertragen',
              reason: `Bon ${fmtEur2(bon)} deutlich über Schnitt. Produktmix dieser Maschine als Benchmark testen.`,
            })
          }
        }

        const PRIO_COLOR = { hoch: 'var(--red)', mittel: 'var(--yellow)', niedrig: 'var(--green)' }
        const PRIO_BG    = { hoch: 'rgba(248,113,113,0.08)', mittel: 'rgba(251,191,36,0.08)', niedrig: 'rgba(52,211,153,0.08)' }
        const PRIO_BORDER= { hoch: 'rgba(248,113,113,0.20)', mittel: 'rgba(251,191,36,0.16)', niedrig: 'rgba(52,211,153,0.18)' }

        return (
          <div style={{ background: 'var(--s2)', border: `1px solid ${stBorder}`, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: stBg, border: `1px solid ${stBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                <Lightbulb size={14} color={stColor} />
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: 'var(--muted)' }}>EMPFEHLUNGEN</div>
                <div style={{ fontSize: '12px', color: 'var(--label)' }}>
                  Score {score.toFixed(0)}/100 · Rang #{rank} von {machines.length} · {rec(m, machines, settings)}
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actions.slice(0, 3).map((action, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  padding: '13px 16px', borderRadius: 'var(--r-sm)',
                  background: PRIO_BG[action.priority],
                  border: `1px solid ${PRIO_BORDER[action.priority]}`,
                }}>
                  <div style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1, marginTop: '1px' }}>{action.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{action.title}</span>
                      <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '.5px', color: PRIO_COLOR[action.priority], background: `${PRIO_COLOR[action.priority]}14`, border: `1px solid ${PRIO_BORDER[action.priority]}`, borderRadius: '5px', padding: '1px 7px' }}>
                        {action.priority.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>{action.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon?: React.ReactNode | null
}) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        {icon && <span style={{ color: 'var(--muted)' }}>{icon}</span>}
        <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 900, color, letterSpacing: '-0.5px', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub}</div>
    </div>
  )
}

function CostItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: highlight ? 'var(--text)' : 'var(--label)' }}>
        {value}
      </div>
    </div>
  )
}

function ProfitRow({ label, value, total, color, prefix, sub }: {
  label: string; value: number; total: number; color: string; prefix: string; sub?: string
}) {
  const pct = total > 0 ? Math.min(100, (Math.abs(value) / total) * 100) : 0
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <div style={{ fontSize: '12px', color: 'var(--muted)', width: '180px', flexShrink: 0 }}>
        <span style={{ color, fontWeight: 700, marginRight: '4px' }}>{prefix}</span>
        {label}
        {sub && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px', fontWeight: 400 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, height: '6px', background: 'var(--s3)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: '13px', fontWeight: 800, color, minWidth: '80px', textAlign: 'right' }}>
        {prefix}{fmtEur(Math.abs(value))}
      </div>
    </div>
  )
}

function NoHistory() {
  return (
    <div style={{
      height: '160px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '8px',
    }}>
      <svg width="120" height="40" viewBox="0 0 120 40">
        {[0,20,40,60,80,100,120].map((x, i) => {
          const heights = [20, 28, 18, 34, 24, 38, 30]
          return <rect key={x} x={x - 7} y={40 - heights[i]} width="10" height={heights[i]} rx="3" fill="var(--s3)" />
        })}
      </svg>
      <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
        Speichere Snapshots für Verlaufsdaten
      </div>
    </div>
  )
}
