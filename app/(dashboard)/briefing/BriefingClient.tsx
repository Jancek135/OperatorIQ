'use client'

import Link from 'next/link'
import React from 'react'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import {
  getMRev, getMTx, getMWE, getFleetRev, getFleetTx, getAvgRev,
  status, calcScore, fmtEur, fmtEur2, buildAIInsights,
  type AIInsight,
} from '@/lib/calculations'
import {
  Newspaper, TrendingUp, TrendingDown, AlertTriangle,
  Trophy, Zap, MapPin, ArrowRight, CheckCircle2,
  ChevronRight, Cpu, RefreshCw,
} from 'lucide-react'

interface Props {
  machines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
  fullName: string
}

// ── Helpers ──────────────────────────────────────────────────

const DAY_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONTH_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function todayLabel() {
  const d = new Date()
  return `${DAY_DE[d.getDay()]}, ${d.getDate()}. ${MONTH_DE[d.getMonth()]} ${d.getFullYear()}`
}

function greetingWord(fullName: string) {
  const hour = new Date().getHours()
  const first = fullName.split(' ')[0] || 'Chef'
  if (hour < 11) return `Guten Morgen, ${first}`
  if (hour < 17) return `Guten Tag, ${first}`
  return `Guten Abend, ${first}`
}

// ── Main headline logic ────────────────────────────────────────

function computeHeadline(
  machines: Machine[],
  settings: FleetSettings,
): { emoji: string; title: string; body: string; color: string } {
  const criticals = machines.filter(m => status(m, machines, settings) === 'r')
  const tops      = machines.filter(m => status(m, machines, settings) === 'g')
  const fleetRev  = getFleetRev(machines)
  const avgRev    = getAvgRev(machines)

  // Priority 1: critical machines
  if (criticals.length > 0) {
    const worst = [...criticals].sort((a, b) => getMRev(a) - getMRev(b))[0]
    return {
      emoji: '🔴',
      title: criticals.length === 1
        ? `${worst.name} läuft im Verlust`
        : `${criticals.length} Maschinen im kritischen Bereich`,
      body: criticals.length === 1
        ? `${worst.name} am Standort ${worst.standort} erwirtschaftet aktuell nicht genug um die Fixkosten zu decken. Sofortmaßnahme empfohlen.`
        : `${criticals.map(m => m.name).join(', ')} decken ihre Fixkosten nicht. Überprüfe Standorte und Sortiment.`,
      color: 'var(--red)',
    }
  }

  // Priority 2: strong performer worth highlighting
  if (tops.length > 0) {
    const best = [...tops].sort((a, b) => getMRev(b) - getMRev(a))[0]
    const bestRev = getMRev(best)
    const delta = avgRev > 0 ? ((bestRev - avgRev) / avgRev * 100).toFixed(0) : '0'
    return {
      emoji: '🏆',
      title: `${best.name} führt die Flotte an`,
      body: `Mit ${fmtEur(bestRev)}/Monat liegt ${best.name} ${delta}% über dem Flottenduschschnitt. Alles im grünen Bereich.`,
      color: 'var(--green)',
    }
  }

  // Priority 3: neutral fleet overview
  return {
    emoji: '📊',
    title: `Flotte läuft stabil — ${fmtEur(fleetRev)}/Monat`,
    body: `${machines.length} Maschinen aktiv, alle im Normalbetrieb. Kein unmittelbarer Handlungsbedarf.`,
    color: 'var(--teal)',
  }
}

// ── Standort aggregation ───────────────────────────────────────

function getStandorte(machines: Machine[]) {
  const map = new Map<string, Machine[]>()
  for (const m of machines) {
    const list = map.get(m.standort) ?? []
    list.push(m)
    map.set(m.standort, list)
  }
  return Array.from(map.entries()).map(([name, ms]) => ({
    name,
    rev: ms.reduce((s, m) => s + getMRev(m), 0),
    tx:  ms.reduce((s, m) => s + getMTx(m), 0),
    count: ms.length,
    machines: ms,
  })).sort((a, b) => b.rev - a.rev)
}

// ── Last month comparison ──────────────────────────────────────

function getLastMonthRev(machines: Machine[], snapshots: Snapshot[]): number | null {
  if (snapshots.length === 0) return null
  const labels = [...new Set(snapshots.map(s => s.month_label))].sort()
  const lastLabel = labels[labels.length - 1]
  if (!lastLabel) return null
  const snaps = snapshots.filter(s => s.month_label === lastLabel)
  return snaps.reduce((s, sn) => s + sn.rev, 0)
}

// ── Sub-components ─────────────────────────────────────────────

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      <div style={{ color: 'var(--teal)', display: 'flex' }}>{icon}</div>
      <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.2px', color: 'var(--muted)' }}>
        {label}
      </span>
    </div>
  )
}

function MachineRow({ m, machines, settings, rank }: {
  m: Machine; machines: Machine[]; settings: FleetSettings; rank?: number
}) {
  const st    = status(m, machines, settings)
  const rev   = getMRev(m)
  const tx    = getMTx(m)
  const score = calcScore(m, machines, settings)
  const COLOR = { g: 'var(--green)', y: 'var(--yellow)', r: 'var(--red)' }
  const c = COLOR[st]

  return (
    <Link href={`/machines/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          background: 'var(--s3)', borderRadius: 'var(--r-sm)',
          border: `1px solid rgba(${st === 'r' ? '248,113,113' : st === 'g' ? '52,211,153' : '251,191,36'},.14)`,
          transition: 'background .15s, transform .14s',
          cursor: 'pointer',
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
        {rank != null && (
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', width: '16px', textAlign: 'center', flexShrink: 0 }}>
            #{rank}
          </div>
        )}
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 6px ${c}88` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={10} />
            {m.standort}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: c }}>{fmtEur(rev)}</div>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{tx} TX</div>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>
          {score.toFixed(0)}
        </div>
        <ChevronRight size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
      </div>
    </Link>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function BriefingClient({ machines, snapshots, settings, fullName }: Props) {
  const fleetRev     = getFleetRev(machines)
  const fleetTx      = getFleetTx(machines)
  const avgBon       = fleetTx > 0 ? fleetRev / fleetTx : 0
  const lastMonthRev = getLastMonthRev(machines, snapshots)
  const revDelta     = lastMonthRev && lastMonthRev > 0
    ? ((fleetRev - lastMonthRev) / lastMonthRev) * 100
    : null

  const criticals = machines.filter(m => status(m, machines, settings) === 'r')
  const warnings  = machines.filter(m => status(m, machines, settings) === 'y')
  const tops      = machines.filter(m => status(m, machines, settings) === 'g')

  const ranked    = [...machines].sort((a, b) => getMRev(b) - getMRev(a))
  const worst3    = [...machines].sort((a, b) => getMRev(a) - getMRev(b)).slice(0, 3)
  const best3     = ranked.slice(0, 3)

  const standorte = getStandorte(machines)
  const headline      = computeHeadline(machines, settings)
  const todayActions  = buildAIInsights(machines, settings)
    .sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))
    .slice(0, 5)
  const totalPotential = todayActions.reduce((s, i) => s + (i.potential && i.potential > 0 ? i.potential : 0), 0)

  const totalFixCost = machines.reduce((s, m) => s + (m.fix_cost ?? 0) + m.miete, 0)
  const fleetDB1     = machines.reduce((s, m) => {
    const we = getMWE(m, settings.we_rate)
    return s + getMRev(m) * (1 - we)
  }, 0)
  const fleetProfit  = fleetDB1 - totalFixCost

  return (
    <div style={{ padding: '40px 44px', maxWidth: '1100px' }}>

      {/* ── Masthead ─────────────────────────────────────── */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)',
            }}>
              <Newspaper size={17} />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.5px', color: 'var(--muted)' }}>
                STANDLOMAT DAILY BRIEFING
              </div>
              <div style={{ fontSize: '13px', color: 'var(--label)', fontWeight: 600 }}>
                {todayLabel()}
              </div>
            </div>
          </div>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', color: 'var(--muted)', fontWeight: 600,
            textDecoration: 'none',
            padding: '6px 14px', borderRadius: '8px',
            background: 'var(--s2)', border: '1px solid var(--border)',
            transition: 'color .15s',
          }}>
            <Cpu size={13} />
            Dashboard
          </Link>
        </div>

        {/* Divider with dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--teal)', opacity: 1 - i * 0.3 }} />
            ))}
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
      </div>

      {/* ── Greeting + Headline ───────────────────────────── */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, marginBottom: '8px' }}>
          {greetingWord(fullName)} —
        </div>

        {/* THE #1 headline */}
        <div style={{
          background: 'var(--s2)',
          border: `1px solid ${headline.color}26`,
          borderLeft: `3px solid ${headline.color}`,
          borderRadius: 'var(--r-lg)',
          padding: '24px 28px',
          marginBottom: '0',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '200px', height: '100%',
            background: `radial-gradient(ellipse at 160px 50%, ${headline.color}08 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ fontSize: '36px', lineHeight: 1, flexShrink: 0 }}>{headline.emoji}</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: headline.color, marginBottom: '6px' }}>
                DAS IST DIE WICHTIGSTE SACHE HEUTE
              </div>
              <h1 style={{
                fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px',
                color: 'var(--text)', lineHeight: 1.25, marginBottom: '10px',
              }}>
                {headline.title}
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--label)', lineHeight: 1.65, margin: 0, maxWidth: '620px' }}>
                {headline.body}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Heute solltest du ────────────────────────────── */}
      {todayActions.length > 0 && (
        <div style={{ marginBottom: '36px' }}>
          <div style={{
            background: 'var(--s2)',
            border: '1px solid rgba(56,189,248,0.18)',
            borderRadius: 'var(--r-xl)',
            padding: '24px 28px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0, width: '340px', height: '180px',
              background: 'radial-gradient(ellipse at 280px 0, rgba(56,189,248,0.06) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                  <Zap size={13} color="var(--teal)" />
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--teal)' }}>
                    HEUTE SOLLTEST DU
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {todayActions.length} Maßnahmen · Potenzial{' '}
                  <span style={{ color: 'var(--teal)', fontWeight: 700 }}>+{fmtEur(totalPotential)}/Monat</span>
                </div>
              </div>
            </div>

            {/* Numbered action list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayActions.map((action, i) => {
                const TYPE_COLOR = {
                  critical:    'var(--red)',
                  warning:     'var(--yellow)',
                  opportunity: 'var(--teal)',
                  positive:    'var(--green)',
                } as const
                const c = TYPE_COLOR[action.type]
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px',
                    background: 'var(--s3)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    transition: 'border-color .15s',
                  }}>
                    {/* Number */}
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: `${c}14`, border: `1.5px solid ${c}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 900, color: c, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>

                    {/* Icon */}
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{action.icon}</span>

                    {/* Action text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {action.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                        {action.action}
                      </div>
                    </div>

                    {/* € impact */}
                    {action.potential != null && action.potential > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 900, color: c, letterSpacing: '-0.3px' }}>
                          +{fmtEur(action.potential)}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>/Monat</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Fleet Snapshot ────────────────────────────────── */}
      <div style={{ marginBottom: '36px' }}>
        <SectionTitle icon={<TrendingUp size={14} />} label="FLEET-SNAPSHOT — DIESER MONAT" />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
        }}>
          {[
            {
              label: 'GESAMT-UMSATZ',
              value: fmtEur(fleetRev),
              sub: revDelta !== null
                ? `${revDelta >= 0 ? '+' : ''}${revDelta.toFixed(1)}% vs. letzten Monat`
                : `${machines.length} Maschinen aktiv`,
              color: 'var(--teal)',
              trend: revDelta,
            },
            {
              label: 'FLEET-PROFIT',
              value: fmtEur(fleetProfit),
              sub: 'nach DB1 − Fixkosten',
              color: fleetProfit >= 0 ? 'var(--green)' : 'var(--red)',
              trend: null,
            },
            {
              label: 'Ø BON',
              value: fmtEur2(avgBon),
              sub: `${fleetTx.toLocaleString('de-AT')} Transaktionen`,
              color: 'var(--label)',
              trend: null,
            },
            {
              label: 'STATUS',
              value: `${tops.length} / ${machines.length}`,
              sub: `${criticals.length > 0 ? `${criticals.length} kritisch · ` : ''}${warnings.length} normal`,
              color: criticals.length > 0 ? 'var(--red)' : tops.length === machines.length ? 'var(--green)' : 'var(--yellow)',
              trend: null,
            },
          ].map(kpi => (
            <div key={kpi.label} className="card kpi-hover" style={{
              padding: '18px 20px', position: 'relative', overflow: 'hidden', cursor: 'default',
            }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
                background: `radial-gradient(circle at 70px 0, ${kpi.color}10 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', color: 'var(--muted)', marginBottom: '10px' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: kpi.color, letterSpacing: '-1px', lineHeight: 1, marginBottom: '6px' }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {kpi.trend !== null && (kpi.trend >= 0
                  ? <TrendingUp size={10} color="var(--green)" />
                  : <TrendingDown size={10} color="var(--red)" />
                )}
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two columns: Alerts + Performers ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '36px' }}>

        {/* Alerts */}
        <div>
          <SectionTitle icon={<AlertTriangle size={14} />} label="HANDLUNGSBEDARF" />
          {criticals.length === 0 && warnings.length === 0 ? (
            <div style={{
              background: 'var(--s2)', border: '1px solid rgba(52,211,153,0.18)',
              borderRadius: 'var(--r-lg)', padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <CheckCircle2 size={20} color="var(--green)" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)', marginBottom: '2px' }}>
                  Alles im grünen Bereich
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Keine kritischen Maschinen heute.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {criticals.map(m => (
                <Link key={m.id} href={`/machines/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.22)',
                    borderRadius: 'var(--r-sm)', padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    transition: 'background .15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.09)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.05)'}
                  >
                    <div style={{ fontSize: '16px' }}>🔴</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--red)' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <MapPin size={10} /> {m.standort} · Fixkosten nicht gedeckt
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--red)' }}>{fmtEur(getMRev(m))}</div>
                    </div>
                    <ChevronRight size={14} color="rgba(248,113,113,0.5)" />
                  </div>
                </Link>
              ))}
              {warnings.slice(0, 2).map(m => (
                <Link key={m.id} href={`/machines/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.16)',
                    borderRadius: 'var(--r-sm)', padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    transition: 'background .15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.04)'}
                  >
                    <div style={{ fontSize: '16px' }}>⚠️</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <MapPin size={10} /> {m.standort} · Im Normalbetrieb
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--yellow)' }}>{fmtEur(getMRev(m))}</div>
                    </div>
                    <ChevronRight size={14} color="rgba(251,191,36,0.4)" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top performers */}
        <div>
          <SectionTitle icon={<Trophy size={14} />} label="TOP PERFORMER" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {best3.map((m, i) => (
              <MachineRow key={m.id} m={m} machines={machines} settings={settings} rank={i + 1} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Verlierer ─────────────────────────────────────── */}
      {worst3.some(m => status(m, machines, settings) !== 'g') && (
        <div style={{ marginBottom: '36px' }}>
          <SectionTitle icon={<TrendingDown size={14} />} label="SCHWÄCHSTE MASCHINEN — POTENZIAL" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {worst3.map(m => (
              <MachineRow key={m.id} m={m} machines={machines} settings={settings} />
            ))}
          </div>
        </div>
      )}

      {/* ── Standort-Ranking ──────────────────────────────── */}
      <div style={{ marginBottom: '36px' }}>
        <SectionTitle icon={<MapPin size={14} />} label="STANDORT-RANKING" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {standorte.map((s, i) => {
            const pct = fleetRev > 0 ? (s.rev / fleetRev) * 100 : 0
            return (
              <div key={s.name} style={{
                background: 'var(--s2)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <div style={{
                  fontSize: '11px', fontWeight: 800, color: i === 0 ? 'var(--teal)' : 'var(--muted)',
                  width: '20px', textAlign: 'center', flexShrink: 0,
                }}>
                  #{i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.name}</div>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{s.count} Maschine{s.count !== 1 ? 'n' : ''}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: '4px', background: 'var(--s3)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div
                      className="progress-fill"
                      style={{
                        height: '100%', borderRadius: '99px',
                        width: `${pct}%`,
                        background: i === 0
                          ? 'linear-gradient(90deg, #38bdf8, #1680b0)'
                          : 'linear-gradient(90deg, var(--s4), var(--s3))',
                      }}
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: i === 0 ? 'var(--teal)' : 'var(--label)' }}>
                    {fmtEur(s.rev)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{pct.toFixed(0)}% der Flotte</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Quick Checklist ───────────────────────────────── */}
      <div style={{ marginBottom: '36px' }}>
        <SectionTitle icon={<Zap size={14} />} label="TAGES-CHECKLIST" />
        <div style={{
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {[
            criticals.length > 0
              ? { done: false, text: `${criticals.length} kritische Maschine${criticals.length > 1 ? 'n' : ''} prüfen` }
              : { done: true,  text: 'Keine kritischen Maschinen — Flotte stabil' },
            { done: snapshots.length > 0, text: 'Monatliche Snapshots vorhanden' },
            { done: totalFixCost > 0,     text: 'Fixkosten & Mieten hinterlegt' },
            { done: fleetProfit > 0,      text: `Flotte profitabel — ${fmtEur(fleetProfit)} Gewinn/Monat` },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                background: item.done ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.10)',
                border: `1.5px solid ${item.done ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,0.30)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px',
              }}>
                {item.done ? '✓' : '·'}
              </div>
              <span style={{
                fontSize: '13px', fontWeight: item.done ? 500 : 600,
                color: item.done ? 'var(--muted)' : 'var(--text)',
                textDecoration: item.done ? 'line-through' : 'none',
                textDecorationColor: 'var(--s4)',
              }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        paddingTop: '24px', borderTop: '1px solid var(--border)',
        color: 'var(--muted)', fontSize: '11px',
      }}>
        <RefreshCw size={12} />
        <span>Daten werden bei jedem Öffnen dieser Seite aktualisiert.</span>
        <div style={{ flex: 1 }} />
        <Link href="/machines" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          color: 'var(--teal)', fontSize: '11px', fontWeight: 600, textDecoration: 'none',
        }}>
          Alle Maschinen <ArrowRight size={11} />
        </Link>
      </div>

    </div>
  )
}
