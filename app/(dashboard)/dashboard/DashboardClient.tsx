'use client'

import React, { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import {
  getFleetRev, getFleetTx, getAvgRev, getAvgBon,
  calcProfit, buildInsights, buildAlerts, buildAIInsights,
  fmtEur, fmtEur2, fmtPct, status,
  calcFleetTrend, calcProfitTrend,
  type AIInsight,
} from '@/lib/calculations'
import MachineCard from '@/components/MachineCard'
import LagerKPISection from '@/components/LagerKPISection'
import CSVImport from '@/components/CSVImport'
import SnapshotModal from '@/components/SnapshotModal'
import ChartsSection from '@/components/ChartsSection'
import AIPanel from '@/components/AIPanel'
import {
  TrendingUp, BarChart2, ShoppingCart, Activity,
  Camera, Zap, ChevronRight,
} from 'lucide-react'

type Filter = 'all' | 'g' | 'y' | 'r'

interface LagerKPIs {
  lagerwert: number
  totesKapital: number
  baldLeer: number
}

interface Props {
  machines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
  accountId: string
  fullName: string
  lagerKPIs?: LagerKPIs | null
}

function greeting(name: string) {
  const h = new Date().getHours()
  const sal = h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'
  return `${sal}, ${name.split(' ')[0] || 'Chef'}`
}

function actionHref(action: AIInsight): string {
  if (action.icon === '📦') return '/simulator'   // WE rate → Simulator
  if (action.icon === '📍') return '/locations'   // location → Standorte
  if (action.icon === '⭐') return '/locations'   // best location → Standorte
  if (action.machine)       return '/machines'    // machine-specific → Maschinen
  return '/simulator'
}

// ─── Colour palette per action type ──────────────────────────────────────────
const TYPE_STYLE = {
  critical:    { color: 'var(--red)',    bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.20)', label: 'KRITISCH' },
  warning:     { color: 'var(--yellow)', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.18)',  label: 'WARNUNG'  },
  opportunity: { color: 'var(--teal)',   bg: 'rgba(56,189,248,0.06)',  border: 'rgba(56,189,248,0.16)',  label: 'CHANCE'   },
  positive:    { color: 'var(--green)',  bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.16)',  label: 'STARK'    },
} as const

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardClient({ machines, snapshots, settings, accountId, fullName, lagerKPIs }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [filter,       setFilter]       = useState<Filter>('all')
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [,             startTransition] = useTransition()
  const [importToast,  setImportToast]  = useState<string | null>(null)

  // ── CSV Import Success Toast ──
  useEffect(() => {
    if (searchParams.get('import') === 'success') {
      const count = searchParams.get('count') ?? '?'
      setImportToast(`✓ CSV Import erfolgreich — ${count} Maschine${count !== '1' ? 'n' : ''} aktualisiert`)
      router.replace('/dashboard')
      const t = setTimeout(() => setImportToast(null), 5000)
      return () => clearTimeout(t)
    }
    if (searchParams.get('onboarding') === 'done') {
      setImportToast('🎉 Willkommen bei VendoAI! Dein Dashboard ist bereit.')
      router.replace('/dashboard')
      const t = setTimeout(() => setImportToast(null), 6000)
      return () => clearTimeout(t)
    }
  }, [searchParams, router])

  // ── Fleet KPIs ────────────────────────────────────────────────────────────
  const fleetRev    = getFleetRev(machines)
  const fleetTx     = getFleetTx(machines)
  const avgRev      = getAvgRev(machines)
  const avgBon      = getAvgBon(machines)
  const we          = settings.we_rate
  const profit      = calcProfit(machines, settings)
  const revTrend    = calcFleetTrend(machines, snapshots)
  const profitTrend = calcProfitTrend(machines, snapshots, settings)
  const insights    = buildInsights(machines, settings)
  const alerts      = buildAlerts(machines, settings)

  // ── AI Command Center ─────────────────────────────────────────────────────
  const commandActions = buildAIInsights(machines, settings)
    .sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))
    .slice(0, 5)
  const totalPotential = commandActions.reduce(
    (s, i) => s + (i.potential != null && i.potential > 0 ? i.potential : 0), 0
  )

  // ── Machine status counts ─────────────────────────────────────────────────
  const greenCount  = machines.filter(m => status(m, machines, settings) === 'g').length
  const yellowCount = machines.filter(m => status(m, machines, settings) === 'y').length
  const redCount    = machines.filter(m => status(m, machines, settings) === 'r').length

  const sorted   = [...machines].sort((a, b) =>
    (b.rev_override ?? b.baseline_rev) - (a.rev_override ?? a.baseline_rev)
  )
  const filtered = filter === 'all'
    ? sorted
    : sorted.filter(m => status(m, machines, settings) === filter)

  function refresh() { startTransition(() => router.refresh()) }

  // ── ONBOARDING (no machines yet) ──────────────────────────────────────────
  if (machines.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '32px' }}>
        <div style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎰</div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '10px' }}>Willkommen bei VendoAI!</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px' }}>
            Dein Fleet-Dashboard ist bereit. Füge deine erste Maschine hinzu,
            um Umsätze, Deckungsbeiträge und Performance zu tracken.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'stretch' }}>
            <a href="/machines/new" className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px 24px', fontSize: '15px' }}>
              ➕ Erste Maschine hinzufügen
            </a>
            <CSVImport machines={[]} accountId={accountId} onImportDone={refresh} />
          </div>
          <div style={{ marginTop: '40px', background: 'var(--s1)', borderRadius: '12px', padding: '20px 24px', textAlign: 'left' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, marginBottom: '14px', letterSpacing: '.5px' }}>WAS KANNST DU HIER MACHEN?</div>
            {[
              ['📊', 'Umsätze & Deckungsbeiträge pro Maschine tracken'],
              ['📸', 'Monats-Snapshots für Zeitvergleiche speichern'],
              ['📥', 'Umsatzdaten per CSV aus Televend importieren'],
              ['✏️', 'Maschinen direkt im Dashboard bearbeiten'],
            ].map(([icon, text], i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
                <span style={{ color: 'var(--muted)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN DASHBOARD ────────────────────────────────────────────────────────
  return (
    <div className="page-pad" style={{ padding: '40px 44px', maxWidth: '1440px', margin: '0 auto', position: 'relative' }}>

      {/* CSV Import Toast */}
      {importToast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 100,
          background: 'var(--s2)', border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: '12px', padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'slide-in-right .25s ease',
        }}>
          <span style={{ fontSize: '16px' }}>✓</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green)' }}>{importToast}</span>
          <button onClick={() => setImportToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', marginLeft: '4px', padding: '2px', display: 'flex' }}>
            ×
          </button>
        </div>
      )}

      {/* Page-level ambient glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '560px',
        background: 'radial-gradient(ellipse 65% 45% at 50% -5%, rgba(56,189,248,0.055) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── 1. GREETING ROW ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.8px', lineHeight: 1.1 }}>
              {greeting(fullName)} 👋
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
                {new Date().toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              {greenCount  > 0 && <StatusChip count={greenCount}  label="Top"      type="g" />}
              {yellowCount > 0 && <StatusChip count={yellowCount} label="OK"       type="y" />}
              {redCount    > 0 && <StatusChip count={redCount}    label="Kritisch" type="r" />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <CSVImport machines={machines} accountId={accountId} onImportDone={refresh} />
            <button className="btn btn-ghost" onClick={() => setShowSnapshot(true)} style={{ gap: '7px' }}>
              <Camera size={14} />
              Snapshot
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. AI COMMAND CENTER ─────────────────────────────────────────── */}
      {commandActions.length > 0 && (
        <div style={{ marginBottom: '32px', position: 'relative', zIndex: 1 }}>
          <div style={{
            background: 'var(--s2)',
            border: '1px solid rgba(56,189,248,0.20)',
            borderRadius: 'var(--r-xl)',
            padding: '28px 32px',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 0 60px rgba(56,189,248,0.04), 0 8px 40px rgba(0,0,0,0.5)',
          }}>
            {/* Accent glow */}
            <div style={{
              position: 'absolute', top: 0, right: 0, width: '500px', height: '300px',
              background: 'radial-gradient(ellipse at 420px 0px, rgba(56,189,248,0.07) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />

            {/* Header: label + total potential */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
                  <Zap size={13} color="var(--teal)" />
                  <span style={{ fontSize: '10px', color: 'var(--teal)', fontWeight: 700, letterSpacing: '1.5px' }}>
                    AI COMMAND CENTER
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500, marginBottom: '4px' }}>
                  Heute kannst du voraussichtlich
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '44px', fontWeight: 900, color: 'var(--teal)', letterSpacing: '-2px', lineHeight: 1 }}>
                    +{fmtEur(totalPotential)}
                  </span>
                  <span style={{ fontSize: '16px', color: 'var(--muted)', fontWeight: 500 }}>/Monat erzielen</span>
                </div>
              </div>
            </div>

            {/* Prioritised action list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {commandActions.map((action, i) => (
                <CommandActionRow key={i} index={i + 1} action={action} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. KPI ROW ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '32px', position: 'relative', zIndex: 1 }}>
        <SectionLabel text="FLEET ÜBERSICHT" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '14px' }}>

          {/* Profit — double-wide hero KPI */}
          <div className="card" style={{
            padding: '26px 28px', position: 'relative', overflow: 'hidden',
            border: `1px solid ${profit >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0, width: '180px', height: '140px',
              background: `radial-gradient(circle at 150px 0, ${profit >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)'} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '1px', marginBottom: '16px' }}>
              MONATSGEWINN
            </div>
            <div style={{
              fontSize: '40px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '10px',
              color: profit >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {fmtEur(profit)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                WE {fmtPct(we)} · FK {fmtEur(settings.total_fix + settings.variable_costs)}
              </span>
              {profitTrend != null && <TrendBadge pct={profitTrend} />}
            </div>
          </div>

          <HeroKPI
            label="Gesamtumsatz"
            value={fmtEur(fleetRev)}
            sub={`${machines.length} Maschinen`}
            color="var(--teal)"
            trend={revTrend}
            icon={<TrendingUp size={13} />}
          />
          <HeroKPI
            label="Ø Maschine"
            value={fmtEur(avgRev)}
            sub={`${fleetTx.toLocaleString('de-AT')} TX`}
            color="var(--yellow)"
            icon={<BarChart2 size={13} />}
          />
          <HeroKPI
            label="Ø Bon"
            value={fmtEur2(avgBon)}
            sub="pro Transaktion"
            color="var(--blue)"
            icon={<ShoppingCart size={13} />}
          />

          {/* Status mini card */}
          <div className="card" style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.8px' }}>STATUS</span>
              <Activity size={13} color="var(--muted)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <StatusPill label="TOP"  count={greenCount}  type="g" />
              <StatusPill label="OK"   count={yellowCount} type="y" />
              <StatusPill label="KRIT" count={redCount}    type="r" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. LAGER KPIs ────────────────────────────────────────────────── */}
      {lagerKPIs && (
        <div style={{ position: 'relative', zIndex: 1 }}>
          <LagerKPISection kpis={lagerKPIs} />
        </div>
      )}

      {/* ── 5. CHARTS ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '32px', position: 'relative', zIndex: 1 }}>
        <SectionLabel text="ANALYTICS" />
        <ChartsSection machines={machines} snapshots={snapshots} settings={settings} />
      </div>

      {/* ── 5. AI PANEL (detailed per-machine breakdown) ──────────────────── */}
      <div style={{ marginBottom: '32px', position: 'relative', zIndex: 1 }}>
        <AIPanel machines={machines} settings={settings} />
      </div>

      {/* ── 6. INSIGHTS + ALERTS (supplementary context) ─────────────────── */}
      {(insights.length > 0 || alerts.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: insights.length > 0 && alerts.length > 0 ? '1fr 1fr' : '1fr',
          gap: '16px', marginBottom: '32px', position: 'relative', zIndex: 1,
        }}>
          {insights.length > 0 && (
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'var(--teal)' }} />
                <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '1px' }}>INSIGHTS</span>
                <span style={{
                  fontSize: '10px', background: 'rgba(56,189,248,0.08)', color: 'var(--teal)',
                  border: '1px solid rgba(56,189,248,0.18)', borderRadius: '99px', padding: '1px 7px', fontWeight: 700,
                }}>{insights.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {insights.map((ins, i) => {
                  const icon = ins.icon as string
                  const isOpportunity = icon.includes('📈') || icon.includes('💰') || icon.includes('🚀')
                  const isSuccess     = icon.includes('✅') || icon.includes('🌟') || icon.includes('⭐')
                  const isCost        = icon.includes('💸') || icon.includes('📦') || icon.includes('💡')
                  const accentColor  = isSuccess ? 'var(--green)' : isOpportunity ? 'var(--teal)' : isCost ? 'var(--yellow)' : 'var(--label)'
                  const accentBg     = isSuccess ? 'rgba(52,211,153,0.06)' : isOpportunity ? 'rgba(56,189,248,0.06)' : isCost ? 'rgba(251,191,36,0.06)' : 'var(--s3)'
                  const accentBorder = isSuccess ? 'rgba(52,211,153,0.14)' : isOpportunity ? 'rgba(56,189,248,0.14)' : isCost ? 'rgba(251,191,36,0.12)' : 'var(--border)'
                  return (
                    <div key={i} style={{
                      background: accentBg, borderRadius: 'var(--r-sm)', padding: '10px 12px',
                      fontSize: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start',
                      border: `1px solid ${accentBorder}`,
                    }}>
                      <span style={{ flexShrink: 0, fontSize: '14px' }}>{ins.icon}</span>
                      <span style={{ color: 'var(--label)', lineHeight: 1.55, flex: 1 }}>{ins.text}</span>
                      {isOpportunity && <span style={{ color: accentColor, fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>CHANCE</span>}
                      {isSuccess     && <span style={{ color: accentColor, fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {alerts.length > 0 && (
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'var(--red)' }} />
                <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '1px' }}>ALERTS</span>
                <span style={{
                  fontSize: '10px', background: 'rgba(248,113,113,0.08)', color: 'var(--red)',
                  border: '1px solid rgba(248,113,113,0.18)', borderRadius: '99px', padding: '1px 7px', fontWeight: 700,
                }}>{alerts.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {alerts.map((a, i) => (
                  <div key={i} style={{
                    background: a.severity === 'r' ? 'rgba(248,113,113,0.07)' : 'rgba(251,191,36,0.07)',
                    borderRadius: 'var(--r-sm)', padding: '10px 12px', fontSize: '12px',
                    border: `1px solid ${a.severity === 'r' ? 'rgba(248,113,113,0.16)' : 'rgba(251,191,36,0.14)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '14px' }}>{a.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: a.severity === 'r' ? 'var(--red)' : 'var(--yellow)' }}>{a.machine}</span>
                      <span style={{
                        marginLeft: 'auto', fontSize: '9px', fontWeight: 700, letterSpacing: '.4px',
                        color: a.severity === 'r' ? 'var(--red)' : 'var(--yellow)',
                        background: a.severity === 'r' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
                        borderRadius: '4px', padding: '1px 5px',
                      }}>
                        {a.severity === 'r' ? 'KRITISCH' : 'WARNUNG'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--label)', lineHeight: 1.5, paddingLeft: '20px' }}>{a.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 7. MACHINE CARDS ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <SectionLabel text="MASCHINEN" count={filtered.length} />
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'g', 'y', 'r'] as Filter[]).map(f => {
              const isActive = filter === f
              const cols: Record<string, { bg: string; color: string; border: string }> = {
                all: { bg: 'rgba(56,189,248,0.10)', color: 'var(--teal)',   border: 'rgba(56,189,248,0.22)' },
                g:   { bg: 'rgba(52,211,153,0.10)', color: 'var(--green)',  border: 'rgba(52,211,153,0.22)' },
                y:   { bg: 'rgba(251,191,36,0.10)', color: 'var(--yellow)', border: 'rgba(251,191,36,0.22)' },
                r:   { bg: 'rgba(248,113,113,0.10)',color: 'var(--red)',    border: 'rgba(248,113,113,0.22)' },
              }
              const c = cols[f]
              const count = f === 'all' ? machines.length : f === 'g' ? greenCount : f === 'y' ? yellowCount : redCount
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: isActive ? c.bg : 'var(--s2)',
                  color:      isActive ? c.color  : 'var(--muted)',
                  border:     `1px solid ${isActive ? c.border : 'var(--border)'}`,
                  borderRadius: '99px', padding: '5px 14px',
                  fontSize: '12px', fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', transition: 'all .15s',
                }}>
                  {f === 'all' ? 'Alle' : f === 'g' ? 'Top' : f === 'y' ? 'OK' : 'Kritisch'} · {count}
                </button>
              )
            })}
          </div>
        </div>
        <div className="machine-grid">
          {filtered.map(m => (
            <MachineCard
              key={m.id}
              machine={m}
              machines={machines}
              snapshots={snapshots}
              settings={settings}
              rank={sorted.indexOf(m) + 1}
            />
          ))}
        </div>
      </div>

      {/* Snapshot modal */}
      {showSnapshot && (
        <SnapshotModal
          machines={machines}
          accountId={accountId}
          onDone={refresh}
          onClose={() => setShowSnapshot(false)}
        />
      )}
    </div>
  )
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

/** Numbered action row inside the Command Center */
function CommandActionRow({ index, action }: { index: number; action: AIInsight }) {
  const s = TYPE_STYLE[action.type]
  const href = actionHref(action)

  return (
    <a
      href={href}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'transform .12s, box-shadow .12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = `0 4px 20px ${s.bg}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Priority number badge */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '50%',
        background: 'var(--s3)',
        border: `2px solid ${s.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 900, color: s.color,
        flexShrink: 0,
      }}>
        {index}
      </div>

      {/* Icon */}
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{action.icon}</span>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--label)', marginBottom: '2px', lineHeight: 1.3 }}>
          {action.title}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {action.action}
        </div>
      </div>

      {/* € Impact badge */}
      {action.potential != null && action.potential > 0 && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: s.color, letterSpacing: '-0.5px', lineHeight: 1 }}>
            +{fmtEur(action.potential)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600, marginTop: '1px' }}>/Monat</div>
        </div>
      )}

      {/* CTA arrow */}
      <ChevronRight size={16} color={s.color} style={{ flexShrink: 0, opacity: 0.7 }} />
    </a>
  )
}

function StatusChip({ count, label, type }: { count: number; label: string; type: 'g' | 'y' | 'r' }) {
  const colors = {
    g: { color: 'var(--green)',  bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.15)'  },
    y: { color: 'var(--yellow)', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.15)'  },
    r: { color: 'var(--red)',    bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.15)' },
  }
  const c = colors[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: '99px', padding: '3px 10px', fontSize: '12px', fontWeight: 600,
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.color, display: 'inline-block' }} />
      {count} {label}
    </span>
  )
}

function HeroKPI({ label, value, sub, color, trend, icon }: {
  label: string; value: string; sub: string; color: string; trend?: number | null; icon?: React.ReactNode
}) {
  return (
    <div className="card kpi-hover" style={{ padding: '20px 18px', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '90px', height: '90px',
        background: `radial-gradient(circle at 80px 0, ${color}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.8px' }}>
          {label.toUpperCase()}
        </div>
        {icon && (
          <div style={{
            width: '24px', height: '24px', borderRadius: '6px',
            background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color,
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 900, color, letterSpacing: '-1px', lineHeight: 1, marginBottom: '6px' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: trend != null ? '8px' : 0 }}>{sub}</div>
      {trend != null && <TrendBadge pct={trend} />}
    </div>
  )
}

function SectionLabel({ text, count }: { text: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'var(--teal)', flexShrink: 0 }} />
      <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '1px' }}>{text}</span>
      {count != null && (
        <span style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--teal)',
          background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)',
          borderRadius: '99px', padding: '1px 8px',
        }}>{count}</span>
      )}
    </div>
  )
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  // Unter 0.5% Differenz = kein aussagekräftiger Trend (z.B. Snapshot = aktuelle Baseline)
  if (Math.abs(pct) < 0.005) return (
    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>— kein Vormonat</span>
  )
  const up  = pct > 0
  const abs = Math.abs(pct * 100).toFixed(1)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '11px', fontWeight: 700,
      color: up ? 'var(--green)' : 'var(--red)',
    }}>
      {up ? '↑' : '↓'} {abs}% vs. Vormonat
    </span>
  )
}

function StatusPill({ label, count, type }: { label: string; count: number; type: 'g' | 'y' | 'r' }) {
  return (
    <div className={`chip chip-${type}`} style={{ flex: 1, justifyContent: 'center', padding: '5px 8px' }}>
      <span style={{ fontWeight: 800, fontSize: '14px' }}>{count}</span>
      <span style={{ fontSize: '10px' }}>{label}</span>
    </div>
  )
}
