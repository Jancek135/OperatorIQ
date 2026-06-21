'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import { getMRev, getMTx, getFleetRev, calcProfit, status } from '@/lib/calculations'

interface Props {
  machines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
}

// ── Data builders ──────────────────────────────────────────────────────────

function buildRevenueData(machines: Machine[], snapshots: Snapshot[], settings: FleetSettings) {
  const monthMap: Record<string, { rev: number; tx: number }> = {}
  snapshots.forEach(s => {
    if (!monthMap[s.month_label]) monthMap[s.month_label] = { rev: 0, tx: 0 }
    monthMap[s.month_label].rev += s.rev
    monthMap[s.month_label].tx  += s.tx
  })
  const sorted = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([label, { rev, tx }]) => ({
      month: label.split(' ')[0].slice(0, 3),
      rev:   Math.round(rev),
      profit: Math.round(rev * (1 - settings.we_rate) - (settings.total_fix + settings.variable_costs)),
    }))

  // Add current month
  const currentRev    = getFleetRev(machines)
  const currentProfit = calcProfit(machines, settings)
  const now = new Date().toLocaleDateString('de-AT', { month: 'short' })
  sorted.push({ month: now, rev: Math.round(currentRev), profit: Math.round(currentProfit) })

  return sorted
}

function buildStatusData(machines: Machine[], settings: FleetSettings) {
  const g = machines.filter(m => status(m, machines, settings) === 'g').length
  const y = machines.filter(m => status(m, machines, settings) === 'y').length
  const r = machines.filter(m => status(m, machines, settings) === 'r').length
  return [
    { name: 'Top Performance', value: g, color: '#10d98a' },
    { name: 'Normalbetrieb',   value: y, color: '#f59e0b' },
    { name: 'Kritisch',        value: r, color: '#f04f4f' },
  ].filter(d => d.value > 0)
}

function buildTopMachinesData(machines: Machine[]) {
  const total = machines.reduce((s, m) => s + getMRev(m), 0)
  return [...machines]
    .sort((a, b) => getMRev(b) - getMRev(a))
    .slice(0, 5)
    .map(m => ({
      loc: m.name,
      rev: Math.round(getMRev(m)),
      pct: total > 0 ? (getMRev(m) / total) * 100 : 0,
    }))
}

// ── Custom tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--s1)', border: '1px solid rgba(56,189,248,0.18)',
      borderRadius: '10px', padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: '6px', fontWeight: 700 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: € {p.value.toLocaleString('de-AT')}
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChartsSection({ machines, snapshots, settings }: Props) {
  const revenueData  = buildRevenueData(machines, snapshots, settings)
  const statusData   = buildStatusData(machines, settings)
  const locationData = buildTopMachinesData(machines)
  const hasHistory   = revenueData.length > 1
  const total        = machines.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '0' }}>

      {/* Row 1: Revenue + Profit charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Revenue Area Chart */}
        <div className="card" style={{ padding: '22px 22px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '4px' }}>
                UMSATZENTWICKLUNG
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label)' }}>
                {hasHistory ? `Letzte ${revenueData.length} Monate` : 'Aktueller Monat'}
              </div>
            </div>
            {hasHistory && revenueData.length >= 2 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '2px' }}>AKTUELL</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--teal)' }}>
                  € {revenueData[revenueData.length - 1].rev.toLocaleString('de-AT')}
                </div>
              </div>
            )}
          </div>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height={168}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#38bdf8" stopOpacity={0.32} />
                    <stop offset="55%" stopColor="#38bdf8" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#3d5275', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fill: '#3d5275', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="rev" name="Umsatz" stroke="#38bdf8" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0c1730', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoDataState label="Speichere Snapshots für Verlaufsdaten" />
          )}
        </div>

        {/* Profit Area Chart */}
        <div className="card" style={{ padding: '22px 22px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '4px' }}>
                PROFIT-ENTWICKLUNG
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label)' }}>
                {hasHistory ? 'Nach Fixkosten & WE' : 'Aktueller Monat'}
              </div>
            </div>
            {hasHistory && revenueData.length >= 2 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: '2px' }}>AKTUELL</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: revenueData[revenueData.length - 1].profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  € {revenueData[revenueData.length - 1].profit.toLocaleString('de-AT')}
                </div>
              </div>
            )}
          </div>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height={168}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#34d399" stopOpacity={0.30} />
                    <stop offset="55%" stopColor="#34d399" stopOpacity={0.07} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#f87171" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#3d5275', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={{ fill: '#3d5275', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2} fill="url(#profGrad)" dot={false} activeDot={{ r: 5, fill: '#34d399', stroke: '#0c1730', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoDataState label="Snapshots aktivieren für Profit-Verlauf" />
          )}
        </div>
      </div>

      {/* Row 2: Top Standorte + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px' }}>

        {/* Top 5 Standorte — CSS bars, no lib needed */}
        <div className="card">
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '18px' }}>
            TOP {locationData.length} AUTOMATEN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {locationData.map((loc, i) => (
              <div key={loc.loc}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '18px', height: '18px', borderRadius: '5px',
                      background: i === 0 ? 'rgba(56,189,248,0.12)' : 'var(--s3)',
                      border: `1px solid ${i === 0 ? 'rgba(56,189,248,0.25)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 800,
                      color: i === 0 ? 'var(--teal)' : 'var(--muted)',
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{loc.loc}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>
                      € {loc.rev.toLocaleString('de-AT')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', width: '36px', textAlign: 'right' }}>
                      {loc.pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${loc.pct}%`,
                    background: i === 0
                      ? 'linear-gradient(90deg, var(--teal), rgba(56,189,248,0.45))'
                      : 'linear-gradient(90deg, #2d4268, #1a2e4a)',
                    boxShadow: i === 0 ? '0 0 8px rgba(56,189,248,0.28)' : 'none',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maschinenstatus Donut */}
        <div className="card" style={{ minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '4px', alignSelf: 'flex-start' }}>
            MASCHINENSTATUS
          </div>

          <div style={{ position: 'relative', margin: '8px 0' }}>
            <PieChart width={140} height={140}>
              <Pie
                data={statusData.length > 0 ? statusData : [{ name: 'Keine', value: 1, color: '#132142' }]}
                cx={70} cy={70} innerRadius={46} outerRadius={62}
                strokeWidth={0} dataKey="value" startAngle={90} endAngle={-270}
              >
                {(statusData.length > 0 ? statusData : [{ color: '#1f3055' }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
            {/* Center label */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: '26px', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>
                {total}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px' }}>
                TOTAL
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {statusData.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: s.color,
                    boxShadow: `0 0 6px ${s.color}88`,
                  }} />
                  <span style={{ fontSize: '11px', color: 'var(--label)' }}>{s.name}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function NoDataState({ label }: { label: string }) {
  return (
    <div style={{
      height: '140px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '8px',
    }}>
      {/* Mini sparkline placeholder */}
      <svg width="120" height="40" viewBox="0 0 120 40">
        {[0,20,40,60,80,100,120].map((x, i) => {
          const heights = [20, 28, 18, 34, 24, 38, 30]
          const h = heights[i]
          return <rect key={x} x={x - 7} y={40 - h} width="10" height={h} rx="3" fill="var(--s3)" />
        })}
      </svg>
      <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>{label}</div>
    </div>
  )
}
