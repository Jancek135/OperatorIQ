'use client'

import { useState, useMemo } from 'react'
import {
  SlidersHorizontal, TrendingUp, TrendingDown, Zap,
  ChevronRight, RotateCcw, Info, Target, Package, Wrench, PlusCircle
} from 'lucide-react'
import type { Machine, FleetSettings } from '@/lib/types'
import { getMRev, getMTx, getMWE, getFleetRev, getAvgRev, calcProfit, fmtEur, fmtPct } from '@/lib/calculations'

// ─── Types ──────────────────────────────────────────────────────
interface Props {
  machines: Machine[]
  settings: FleetSettings
}

interface Scenario {
  label: string
  icon: React.ReactNode
  we: number
  revGrowth: number
  fixDelta: number
  extraMachines: number
}

// ─── Helpers ────────────────────────────────────────────────────
function fmtEurShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' Mio'
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + ' k'
  return n.toFixed(0)
}

function pctStr(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + ' %'
}

// Range input with styled track
function Slider({
  label, icon, value, min, max, step, displayValue, onChange, color = 'var(--teal)', hint,
}: {
  label: string
  icon: React.ReactNode
  value: number
  min: number
  max: number
  step: number
  displayValue: string
  onChange: (v: number) => void
  color?: string
  hint?: string
}) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--muted)' }}>{icon}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
          {hint && (
            <span title={hint} style={{ cursor: 'help', color: 'var(--muted)', lineHeight: 0 }}>
              <Info size={12} />
            </span>
          )}
        </div>
        <span style={{
          fontSize: '15px', fontWeight: 700, color,
          background: 'var(--s3)', padding: '3px 12px', borderRadius: '8px',
          border: `1px solid ${color}33`,
          minWidth: '80px', textAlign: 'right',
        }}>
          {displayValue}
        </span>
      </div>

      {/* custom-styled range */}
      <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
        {/* track background */}
        <div style={{
          position: 'absolute', width: '100%', height: '4px',
          borderRadius: '99px', background: 'var(--s4)',
        }} />
        {/* filled portion */}
        <div style={{
          position: 'absolute', height: '4px',
          width: `${pct}%`,
          borderRadius: '99px',
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: `0 0 8px ${color}44`,
          transition: 'width .06s',
        }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            position: 'relative', width: '100%', appearance: 'none', background: 'transparent',
            cursor: 'pointer', height: '20px',
            // thumb styles via CSS class below
          }}
          className="sim-range"
        />
      </div>

      {/* tick labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
          {typeof min === 'number' && min < 1 ? pctStr(min, 0) : (min >= 0 ? '+' : '') + min}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
          {typeof max === 'number' && max <= 1 ? pctStr(max, 0) : (max >= 0 ? '+' : '') + max}
        </span>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function SimulatorClient({ machines, settings }: Props) {
  // Current base values
  const baseFleetRev   = getFleetRev(machines)
  const baseWE         = settings.we_rate
  const baseFix        = settings.total_fix
  const baseVar        = settings.variable_costs
  const baseTotalCosts = baseFix + baseVar
  const avgRevPerMach  = machines.length > 0 ? baseFleetRev / machines.length : 3000
  const baseProfit     = calcProfit(machines, settings)
  const baseMiete      = machines.reduce((s, m) => s + m.miete, 0)
  // break-even at base
  const baseBreakEven  = baseTotalCosts > 0 && (1 - baseWE) > 0
    ? baseTotalCosts / (1 - baseWE)
    : 0
  const baseMarge      = baseFleetRev > 0 ? baseProfit / baseFleetRev : 0

  // ── Slider state ──
  const [weRate,      setWeRate]      = useState(baseWE)
  const [revGrowth,   setRevGrowth]   = useState(0)      // -0.3 to +0.5
  const [fixDelta,    setFixDelta]    = useState(0)      // -0.4 to +0.3 of baseFix
  const [extraMach,   setExtraMach]   = useState(0)      // 0–5 additional machines

  const hasChanges = weRate !== baseWE || revGrowth !== 0 || fixDelta !== 0 || extraMach !== 0

  // ── Computed simulation ──
  const sim = useMemo(() => {
    const simRev    = baseFleetRev * (1 + revGrowth) + extraMach * avgRevPerMach
    const simFix    = baseFix * (1 + fixDelta)
    const simProfit = simRev * (1 - weRate) - (simFix + baseVar)
    const simMarge  = simRev > 0 ? simProfit / simRev : 0
    const simBreakE = (simFix + baseVar) > 0 && (1 - weRate) > 0
      ? (simFix + baseVar) / (1 - weRate)
      : 0

    const deltaMonat = simProfit - baseProfit
    const deltaJahr  = deltaMonat * 12
    const deltaPct   = baseProfit !== 0
      ? (simProfit - baseProfit) / Math.abs(baseProfit)
      : simProfit > 0 ? 1 : 0

    return { simRev, simFix, simProfit, simMarge, simBreakE, deltaMonat, deltaJahr, deltaPct }
  }, [weRate, revGrowth, fixDelta, extraMach, baseFleetRev, avgRevPerMach, baseFix, baseVar, baseProfit])

  function reset() {
    setWeRate(baseWE)
    setRevGrowth(0)
    setFixDelta(0)
    setExtraMach(0)
  }

  function applyScenario(s: Scenario) {
    setWeRate(s.we)
    setRevGrowth(s.revGrowth)
    setFixDelta(s.fixDelta)
    setExtraMach(s.extraMachines)
  }

  // Preset scenarios
  const SCENARIOS: Scenario[] = [
    {
      label: 'WE auf 28 % senken',
      icon: <Package size={14} />,
      we: 0.28,
      revGrowth: 0,
      fixDelta: 0,
      extraMachines: 0,
    },
    {
      label: '+ 10 % Umsatz',
      icon: <TrendingUp size={14} />,
      we: baseWE,
      revGrowth: 0.10,
      fixDelta: 0,
      extraMachines: 0,
    },
    {
      label: 'Kosten − 15 %',
      icon: <Wrench size={14} />,
      we: baseWE,
      revGrowth: 0,
      fixDelta: -0.15,
      extraMachines: 0,
    },
    {
      label: '2 neue Maschinen',
      icon: <PlusCircle size={14} />,
      we: baseWE,
      revGrowth: 0,
      fixDelta: 0,
      extraMachines: 2,
    },
    {
      label: 'Best Case',
      icon: <Zap size={14} />,
      we: 0.28,
      revGrowth: 0.15,
      fixDelta: -0.10,
      extraMachines: 1,
    },
  ]

  const isPositive = sim.deltaMonat >= 0
  const deltaColor = isPositive ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }} className="fade-in sim-page">

      {/* ── Header ── */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(56,189,248,0.12))',
              border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SlidersHorizontal size={18} color="var(--purple)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.3px' }}>
              Profit-Simulator
            </h1>
            <span className="chip chip-b" style={{ fontSize: '10px', background: 'rgba(167,139,250,0.10)', color: 'var(--purple)', border: '1px solid rgba(167,139,250,0.22)' }}>
              Was wäre wenn?
            </span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '480px' }}>
            Verschiebe die Regler und sieh sofort, wie sich Änderungen am WE-Satz, Umsatz
            oder Kosten auf deinen Jahresgewinn auswirken.
          </p>
        </div>
        {hasChanges && (
          <button className="btn btn-ghost" onClick={reset} style={{ gap: '6px' }}>
            <RotateCcw size={14} />
            Zurücksetzen
          </button>
        )}
      </div>

      {/* ── Profit Comparison Bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '0',
        marginBottom: '32px',
        background: 'var(--s2)',
        border: '1px solid var(--border-card)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: 'var(--glow-card)',
      }}>
        {/* IST */}
        <div style={{ padding: '28px 28px 28px 28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            IST — Aktuell
          </div>
          <div style={{
            fontSize: '32px', fontWeight: 800, letterSpacing: '-.5px',
            color: baseProfit >= 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {fmtEur(baseProfit)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>/ Monat</div>
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <MetaRow label="Umsatz" value={fmtEur(baseFleetRev)} />
            <MetaRow label="WE-Satz" value={pctStr(baseWE)} />
            <MetaRow label="Fixkosten" value={fmtEur(baseFix)} />
            <MetaRow label="Break-Even" value={baseBreakEven > 0 ? fmtEur(baseBreakEven) : '–'} />
            <MetaRow label="Nettomarge" value={pctStr(baseMarge)} highlight={baseMarge > 0.08} />
          </div>
        </div>

        {/* Arrow / Delta */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '0 20px', minWidth: '160px',
          borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
          background: hasChanges ? `${deltaColor}08` : 'transparent',
        }}>
          {hasChanges ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {isPositive
                  ? <TrendingUp size={20} color="var(--green)" />
                  : <TrendingDown size={20} color="var(--red)" />
                }
              </div>
              <div style={{
                fontSize: '28px', fontWeight: 800, letterSpacing: '-.4px',
                color: deltaColor, textAlign: 'center',
              }}>
                {isPositive ? '+' : '−'}{fmtEur(Math.abs(sim.deltaMonat))}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>/ Monat</div>
              <div style={{
                fontSize: '13px', fontWeight: 700, color: deltaColor, textAlign: 'center',
                background: `${deltaColor}12`, borderRadius: '10px', padding: '6px 12px',
                border: `1px solid ${deltaColor}30`,
              }}>
                {isPositive ? '+' : '−'}€ {fmtEurShort(Math.abs(sim.deltaJahr))} / Jahr
              </div>
              {sim.deltaPct !== 0 && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                  {isPositive ? '+' : ''}{(sim.deltaPct * 100).toFixed(0)} % vs. Ist
                </div>
              )}
            </>
          ) : (
            <>
              <ChevronRight size={28} color="var(--muted)" style={{ opacity: .4 }} />
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', textAlign: 'center' }}>
                Regler bewegen
              </div>
            </>
          )}
        </div>

        {/* SIMULIERT */}
        <div style={{ padding: '28px 28px 28px 28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            SIMULIERT
          </div>
          <div style={{
            fontSize: '32px', fontWeight: 800, letterSpacing: '-.5px',
            color: sim.simProfit >= 0 ? 'var(--green)' : 'var(--red)',
            transition: 'color .2s',
          }}>
            {fmtEur(sim.simProfit)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>/ Monat</div>
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <MetaRowDiff label="Umsatz" cur={baseFleetRev} sim={sim.simRev} fmt={fmtEur} />
            <MetaRowDiff label="WE-Satz" cur={baseWE} sim={weRate} fmt={v => pctStr(v)} invert />
            <MetaRowDiff label="Fixkosten" cur={baseFix} sim={sim.simFix} fmt={fmtEur} invert />
            <MetaRowDiff
              label="Break-Even"
              cur={baseBreakEven}
              sim={sim.simBreakE}
              fmt={v => v > 0 ? fmtEur(v) : '–'}
              invert
            />
            <MetaRowDiff
              label="Nettomarge"
              cur={baseMarge}
              sim={sim.simMarge}
              fmt={v => pctStr(v)}
              highlight={sim.simMarge > 0.08}
            />
          </div>
        </div>
      </div>

      {/* ── Sliders + Presets grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>

        {/* Sliders */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={14} color="var(--muted)" />
            Stellschrauben
          </div>

          {/* WE Rate */}
          <Slider
            label="Wareneinsatz (WE)"
            icon={<Package size={15} />}
            value={weRate}
            min={0.18}
            max={0.52}
            step={0.005}
            displayValue={pctStr(weRate)}
            onChange={setWeRate}
            color="var(--purple)"
            hint="Anteil der Wareneinkaufskosten am Umsatz. Senkung = mehr DB."
          />

          {/* Revenue Growth */}
          <Slider
            label="Umsatz-Wachstum"
            icon={<TrendingUp size={15} />}
            value={revGrowth}
            min={-0.30}
            max={0.50}
            step={0.01}
            displayValue={(revGrowth >= 0 ? '+' : '') + (revGrowth * 100).toFixed(0) + ' %'}
            onChange={setRevGrowth}
            color="var(--teal)"
            hint="Prozentuale Veränderung des gesamten Fleet-Umsatzes."
          />

          {/* Fix cost delta */}
          {baseFix > 0 && (
            <Slider
              label="Fixkosten-Änderung"
              icon={<Wrench size={15} />}
              value={fixDelta}
              min={-0.40}
              max={0.30}
              step={0.01}
              displayValue={(fixDelta >= 0 ? '+' : '') + (fixDelta * 100).toFixed(0) + ' % (' + fmtEur(sim.simFix) + ')'}
              onChange={setFixDelta}
              color="var(--yellow)"
              hint="Prozentuale Änderung der Gesamtfixkosten (Miete, Personal, etc.)."
            />
          )}

          {/* Extra Machines */}
          <Slider
            label="Neue Maschinen"
            icon={<PlusCircle size={15} />}
            value={extraMach}
            min={0}
            max={8}
            step={1}
            displayValue={extraMach === 0 ? '+ 0' : `+ ${extraMach} (Ø ${fmtEur(avgRevPerMach)} / Mo)`}
            onChange={setExtraMach}
            color="var(--green)"
            hint={`Ø Umsatz pro Maschine: ${fmtEur(avgRevPerMach)} / Mo. Fixkosten bleiben konstant.`}
          />

          {/* Per-machine detail for extra machines */}
          {extraMach > 0 && (
            <div style={{
              background: 'var(--s3)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '12px',
              color: 'var(--label)',
              marginTop: '-8px',
              marginBottom: '16px',
            }}>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{extraMach} Maschinen</span>
              {' '}× {fmtEur(avgRevPerMach)} = <span style={{ fontWeight: 600 }}>{fmtEur(extraMach * avgRevPerMach)}</span> / Mo zusätzlich
              <div style={{ color: 'var(--muted)', marginTop: '3px', fontSize: '11px' }}>
                Fixkosten-Anstieg nicht eingerechnet — konservativ rechnen!
              </div>
            </div>
          )}
        </div>

        {/* Right: Presets + Year card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Annual Impact Highlight */}
          {hasChanges && (
            <div style={{
              background: isPositive
                ? 'linear-gradient(135deg, rgba(52,211,153,0.10), rgba(52,211,153,0.04))'
                : 'linear-gradient(135deg, rgba(248,113,113,0.10), rgba(248,113,113,0.04))',
              border: `1px solid ${deltaColor}30`,
              borderRadius: '16px',
              padding: '22px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Jahresauswirkung
              </div>
              <div style={{ fontSize: '38px', fontWeight: 900, color: deltaColor, letterSpacing: '-.5px' }}>
                {isPositive ? '+' : '−'}€ {fmtEurShort(Math.abs(sim.deltaJahr))}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>pro Jahr</div>
              <div style={{
                marginTop: '14px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.5,
                borderTop: `1px solid ${deltaColor}20`, paddingTop: '12px',
              }}>
                {isPositive
                  ? `Diese Kombination würde € ${fmtEurShort(Math.abs(sim.deltaJahr))} mehr pro Jahr bedeuten.`
                  : `Diese Kombination würde € ${fmtEurShort(Math.abs(sim.deltaJahr))} weniger pro Jahr bedeuten.`
                }
              </div>
            </div>
          )}

          {/* Scenarios */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--label)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={13} color="var(--muted)" />
              Szenarien
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SCENARIOS.map((sc, i) => {
                // compute delta for this scenario
                const scRev    = baseFleetRev * (1 + sc.revGrowth) + sc.extraMachines * avgRevPerMach
                const scFix    = baseFix * (1 + sc.fixDelta)
                const scProfit = scRev * (1 - sc.we) - (scFix + baseVar)
                const scDelta  = scProfit - baseProfit
                const scPos    = scDelta >= 0
                const active   = weRate === sc.we && revGrowth === sc.revGrowth && fixDelta === sc.fixDelta && extraMach === sc.extraMachines

                return (
                  <button
                    key={i}
                    onClick={() => applyScenario(sc)}
                    style={{
                      background: active ? 'rgba(56,189,248,0.08)' : 'var(--s3)',
                      border: `1px solid ${active ? 'rgba(56,189,248,0.22)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      padding: '10px 13px',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all .15s',
                      color: active ? 'var(--teal)' : 'var(--text)',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.borderColor = 'rgba(56,189,248,0.18)'
                        e.currentTarget.style.background = 'var(--s4)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.background = 'var(--s3)'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500 }}>
                      <span style={{ color: 'var(--muted)' }}>{sc.icon}</span>
                      {sc.label}
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      color: scPos ? 'var(--green)' : 'var(--red)',
                    }}>
                      {scPos ? '+' : '−'}€{fmtEurShort(Math.abs(scDelta))}/Mo
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{
            background: 'var(--s2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '11.5px',
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}>
            <Info size={12} style={{ marginBottom: '-2px', marginRight: '4px', color: 'var(--muted)' }} />
            Simulation basiert auf aktuellen Baseline-Werten. Variable Kosten bleiben konstant.
            Neue Maschinen ohne zusätzliche Fixkosten gerechnet.
          </div>
        </div>
      </div>

      {/* ── Machine Breakdown ── */}
      {machines.length > 0 && (revGrowth !== 0 || extraMach > 0) && (
        <div className="card" style={{ marginTop: '24px', padding: '22px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label)', marginBottom: '16px' }}>
            Maschinenübersicht (simuliert)
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Maschine</th>
                <th>Standort</th>
                <th style={{ textAlign: 'right' }}>IST Umsatz</th>
                <th style={{ textAlign: 'right' }}>SIM Umsatz</th>
                <th style={{ textAlign: 'right' }}>Delta</th>
              </tr>
            </thead>
            <tbody>
              {machines.map(m => {
                const cur = getMRev(m)
                const sim2 = cur * (1 + revGrowth)
                const d = sim2 - cur
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.standort}</td>
                    <td style={{ textAlign: 'right' }}>{fmtEur(cur)}</td>
                    <td style={{ textAlign: 'right', color: sim2 >= cur ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {fmtEur(sim2)}
                    </td>
                    <td style={{ textAlign: 'right', color: d >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {d >= 0 ? '+' : ''}{fmtEur(d)}
                    </td>
                  </tr>
                )
              })}
              {extraMach > 0 && Array.from({ length: extraMach }).map((_, i) => (
                <tr key={`extra-${i}`} style={{ opacity: .75 }}>
                  <td style={{ fontWeight: 500, color: 'var(--green)' }}>+ Neue Maschine {i + 1}</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>—</td>
                  <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmtEur(avgRevPerMach)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--green)' }}>+{fmtEur(avgRevPerMach)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Range slider global style — dangerouslySetInnerHTML prevents hydration mismatch with > in CSS selectors */}
      <style dangerouslySetInnerHTML={{ __html: `
        .sim-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: var(--s2);
          border: 2px solid var(--teal);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.15);
          cursor: pointer;
          transition: box-shadow .15s, border-color .15s;
        }
        .sim-range::-moz-range-thumb {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: var(--s2);
          border: 2px solid var(--teal);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.15);
          cursor: pointer;
        }
        .sim-range:hover::-webkit-slider-thumb,
        .sim-range:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 5px rgba(56,189,248,0.20);
        }
        @media (max-width: 768px) {
          .sim-page { padding: 16px !important; }
          .sim-page > div:nth-child(3) {
            grid-template-columns: 1fr !important;
          }
          .sim-page > div:nth-child(3) > div:nth-child(2),
          .sim-page > div:nth-child(3) > div:nth-child(3) {
            display: none;
          }
        }
      ` }} />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function MetaRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{label}</span>
      <span style={{
        fontSize: '12px', fontWeight: 600,
        color: highlight ? 'var(--green)' : 'var(--label)',
      }}>
        {value}
      </span>
    </div>
  )
}

function MetaRowDiff({
  label, cur, sim, fmt, invert = false, highlight,
}: {
  label: string
  cur: number
  sim: number
  fmt: (v: number) => string
  invert?: boolean
  highlight?: boolean
}) {
  const diff = sim - cur
  const changed = Math.abs(diff) > 0.0001
  const better = invert ? diff < 0 : diff > 0
  const diffColor = !changed ? 'var(--label)' : better ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {changed && (
          <span style={{ fontSize: '10.5px', color: diffColor }}>
            {better ? '▲' : '▼'}
          </span>
        )}
        <span style={{
          fontSize: '12px', fontWeight: 600,
          color: highlight ? 'var(--green)' : changed ? diffColor : 'var(--label)',
          transition: 'color .2s',
        }}>
          {fmt(sim)}
        </span>
      </div>
    </div>
  )
}
