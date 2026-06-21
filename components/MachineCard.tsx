'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import {
  getMRev, getMTx, getMWE,
  status, rec,
  fmtEur, fmtEur2, fmtPct,
  getAvgRev, calcMachineTrend,
} from '@/lib/calculations'
import Sparkline from './Sparkline'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Trash2, TrendingUp, TrendingDown, Cpu, Coffee, ShoppingBag, Zap } from 'lucide-react'

interface MachineCardProps {
  machine: Machine
  machines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
  rank: number
}

const STATUS_LABEL: Record<string, string> = { g: 'TOP', y: 'OK', r: 'KRITISCH' }

function MachineTypeIcon({ name }: { name: string }) {
  const n = name.toLowerCase()
  if (n.includes('coffee') || n.includes('kaffee')) return <Coffee size={14} />
  if (n.includes('snack') || n.includes('candy')) return <ShoppingBag size={14} />
  if (n.includes('shake') || n.includes('energy')) return <Zap size={14} />
  return <Cpu size={14} />
}

export default function MachineCard({ machine: m, machines, snapshots, settings, rank }: MachineCardProps) {
  const router = useRouter()
  const [editing, setEditing]             = useState(false)
  const [saving, setSaving]               = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  const [editName, setEditName]         = useState(m.name)
  const [editStandort, setEditStandort] = useState(m.standort)
  const [editMiete, setEditMiete]       = useState(m.miete.toString())
  const [editBaseRev, setEditBaseRev]   = useState(m.baseline_rev.toString())
  const [editBaseTx, setEditBaseTx]     = useState(m.baseline_tx.toString())
  const [editFixCost, setEditFixCost]   = useState((m.fix_cost ?? 0).toString())
  const [editWE, setEditWE]             = useState(
    m.we_rate_override !== undefined ? (m.we_rate_override * 100).toFixed(1) : ''
  )

  const st      = status(m, machines, settings)
  const rev     = getMRev(m)
  const tx      = getMTx(m)
  const bon     = tx > 0 ? rev / tx : 0
  const we      = getMWE(m, settings.we_rate)
  const db1     = rev * (1 - we)
  const fixCost = (m.fix_cost ?? 0) + m.miete
  const margin  = fixCost > 0 && rev > 0 ? ((db1 - fixCost) / rev) * 100 : null
  const hasCSV  = m.rev_override !== undefined
  const avgRev  = getAvgRev(machines)
  const revPct  = avgRev > 0 ? (rev / avgRev) * 100 : 0
  const hasWEOverride = m.we_rate_override !== undefined
  const trend   = calcMachineTrend(m, snapshots)

  const stColor = st === 'g' ? 'var(--green)' : st === 'y' ? 'var(--yellow)' : 'var(--red)'
  const stBorder = st === 'g'
    ? 'rgba(52,211,153,0.20)'
    : st === 'y'
    ? 'rgba(251,191,36,0.16)'
    : 'rgba(248,113,113,0.24)'

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('machines').update({
      name:         editName.trim(),
      standort:     editStandort.trim(),
      miete:        parseFloat(editMiete) || 0,
      baseline_rev: parseFloat(editBaseRev) || 0,
      baseline_tx:  parseInt(editBaseTx)   || 0,
    }).eq('id', m.id)

    const fixVal = parseFloat(editFixCost) || 0
    if (fixVal > 0) {
      await supabase.from('machine_costs').upsert(
        { machine_id: m.id, fix_cost: fixVal, updated_at: new Date().toISOString() },
        { onConflict: 'machine_id' }
      )
    } else {
      await supabase.from('machine_costs').delete().eq('machine_id', m.id)
    }

    const weNum = parseFloat(editWE)
    if (!isNaN(weNum) && weNum > 0 && weNum < 100) {
      await supabase.from('we_overrides').upsert(
        { machine_id: m.id, we_rate: weNum / 100, updated_at: new Date().toISOString() },
        { onConflict: 'machine_id' }
      )
    } else if (editWE === '') {
      await supabase.from('we_overrides').delete().eq('machine_id', m.id)
    }

    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('machines').delete().eq('id', m.id)
    router.refresh()
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div style={{
        background: 'var(--s2)', border: '1px solid rgba(56,189,248,0.20)',
        borderRadius: 'var(--r-lg)', padding: '20px',
        boxShadow: '0 0 20px rgba(56,189,248,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pencil size={14} color="var(--teal)" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--teal)' }}>Bearbeiten</span>
          </div>
          <button
            onClick={() => setEditing(false)}
            style={{
              background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--muted)', fontSize: '18px',
              cursor: 'pointer', lineHeight: 1, width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <EField label="NAME">
            <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
          </EField>
          <EField label="STANDORT">
            <input className="input" value={editStandort} onChange={e => setEditStandort(e.target.value)} />
          </EField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <EField label="BASELINE UMSATZ (€)">
              <input className="input" type="number" step="0.01" value={editBaseRev} onChange={e => setEditBaseRev(e.target.value)} />
            </EField>
            <EField label="BASELINE TX">
              <input className="input" type="number" value={editBaseTx} onChange={e => setEditBaseTx(e.target.value)} />
            </EField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <EField label="MIETE (€/Mo)">
              <input className="input" type="number" step="0.01" value={editMiete} onChange={e => setEditMiete(e.target.value)} />
            </EField>
            <EField label="FIXKOSTEN (€/Mo)">
              <input className="input" type="number" step="0.01" value={editFixCost} onChange={e => setEditFixCost(e.target.value)} />
            </EField>
          </div>
          <EField label={`WE-OVERRIDE % (Standard ${(settings.we_rate * 100).toFixed(0)}%)`}>
            <input
              className="input" type="number" step="0.1" min="0" max="100"
              placeholder={`${(settings.we_rate * 100).toFixed(0)}`}
              value={editWE} onChange={e => setEditWE(e.target.value)}
              style={{ width: '140px' }}
            />
          </EField>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} style={{ flex: 1, justifyContent: 'center' }}>
              Abbrechen
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
              {saving ? 'Speichern…' : '✓ Speichern'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── NORMAL VIEW ────────────────────────────────────────────────────────────
  return (
    <div
      onClick={() => router.push(`/machines/${m.id}`)}
      style={{
        background: 'var(--s2)',
        border: `1px solid ${stBorder}`,
        borderRadius: 'var(--r-lg)',
        padding: '24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        transition: 'transform .18s ease, box-shadow .18s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px ${stBorder}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'
      }}
    >
      {/* Status shimmer — top edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: st === 'g'
          ? 'linear-gradient(90deg, transparent, rgba(52,211,153,0.60), transparent)'
          : st === 'y'
          ? 'linear-gradient(90deg, transparent, rgba(251,191,36,0.55), transparent)'
          : 'linear-gradient(90deg, transparent, rgba(248,113,113,0.60), transparent)',
      }} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Rank + type icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: 'var(--muted)',
              background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: '5px', padding: '1px 6px',
            }}>#{rank}</span>
            <span style={{ color: 'var(--muted)' }}>
              <MachineTypeIcon name={m.name} />
            </span>
            {hasCSV && (
              <span className="chip chip-b" style={{ padding: '1px 7px', fontSize: '10px' }}>CSV</span>
            )}
          </div>
          <h3 style={{
            fontSize: '14px', fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: '2px',
          }}>
            {m.name}
          </h3>
          <div style={{ color: 'var(--muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPinIcon />
            {m.standort}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className={`chip chip-${st}`}>{STATUS_LABEL[st]}</span>
            <ActionBtn title="Bearbeiten" onClick={() => setEditing(true)}>
              <Pencil size={13} />
            </ActionBtn>
            {!confirmDelete ? (
              <ActionBtn title="Löschen" onClick={() => setConfirmDelete(true)} danger>
                <Trash2 size={13} />
              </ActionBtn>
            ) : (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  onClick={handleDelete} disabled={deleting}
                  style={{
                    fontSize: '11px', background: 'var(--rdim)', border: '1px solid rgba(240,79,79,0.3)',
                    color: 'var(--red)', borderRadius: '6px', padding: '3px 8px',
                    cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  {deleting ? '…' : 'Ja'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    fontSize: '11px', background: 'var(--s2)', border: '1px solid var(--border)',
                    color: 'var(--muted)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer',
                  }}
                >
                  Nein
                </button>
              </div>
            )}
          </div>
          <Sparkline machine={m} snapshots={snapshots} />
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: '1px', background: 'var(--border)', marginBottom: '16px' }} />

      {/* ── Revenue ── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '.7px', marginBottom: '6px' }}>
          UMSATZ
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <div style={{
            fontSize: '34px', fontWeight: 900, letterSpacing: '-1.5px',
            color: 'var(--text)',
          }}>
            {fmtEur(rev)}
          </div>
          <TrendChip pct={trend.rev} />
        </div>
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
              {revPct.toFixed(0)}% des Fleet-Schnitts
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{
              width: `${Math.min(100, revPct)}%`,
              background: `linear-gradient(90deg, ${stColor}, ${stColor}88)`,
              boxShadow: `0 0 8px ${stColor}55`,
            }} />
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <KpiMini label="TX" value={tx.toString()} trend={trend.tx} />
        <KpiMini label="Ø BON" value={fmtEur2(bon)} />
        <KpiMini label="WE" value={fmtPct(we)} highlight={hasWEOverride} />
      </div>

      {/* ── DB1 / Margin ── */}
      {fixCost > 0 && (
        <div style={{
          background: margin !== null && margin > 0 ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)',
          border: `1px solid ${margin !== null && margin > 0 ? 'rgba(52,211,153,0.16)' : 'rgba(248,113,113,0.16)'}`,
          borderRadius: '10px', padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600, marginBottom: '2px' }}>
              DB1 NACH FIX + MIETE
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: margin !== null && margin > 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmtEur(db1 - fixCost)}
            </div>
          </div>
          <div style={{
            fontSize: '18px', fontWeight: 800,
            color: margin !== null && margin > 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {margin !== null ? `${margin.toFixed(1)}%` : '—'}
          </div>
        </div>
      )}

      {/* ── Recommendation ── */}
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'flex-start',
        padding: '10px 12px',
        background: 'var(--s3)', borderRadius: 'var(--r-sm)',
        border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>
          {st === 'g' ? '✅' : st === 'y' ? '⚠️' : '🔴'}
        </span>
        <span style={{ fontSize: '11.5px', color: 'var(--label)', lineHeight: 1.5 }}>
          {rec(m, machines, settings)}
        </span>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MapPinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function KpiMini({ label, value, trend, highlight }: {
  label: string; value: string; trend?: number | null; highlight?: boolean
}) {
  return (
    <div style={{
      background: 'var(--s3)', borderRadius: 'var(--r-sm)', padding: '9px 11px',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '10px', color: 'var(--muted)', fontWeight: 700,
        letterSpacing: '.5px', marginBottom: '4px',
      }}>{label}</div>
      <div style={{
        fontSize: '13px', fontWeight: 700,
        color: highlight ? 'var(--yellow)' : 'var(--text)',
      }}>
        {value}{highlight ? ' ★' : ''}
      </div>
      {trend != null && <TrendChip pct={trend} small />}
    </div>
  )
}

function TrendChip({ pct, small }: { pct: number | null; small?: boolean }) {
  if (pct === null) return null
  const up  = pct >= 0
  const abs = Math.abs(pct * 100).toFixed(1)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: small ? '10px' : '12px',
      fontWeight: 700,
      color: up ? 'var(--green)' : 'var(--red)',
      marginTop: small ? '3px' : 0,
    }}>
      {up
        ? <TrendingUp size={small ? 10 : 12} />
        : <TrendingDown size={small ? 10 : 12} />
      }
      {abs}%
    </span>
  )
}

function ActionBtn({ children, title, onClick, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? 'rgba(240,79,79,0.1)' : 'rgba(0,212,255,0.1)') : 'var(--s2)',
        border: '1px solid var(--border)',
        borderRadius: '7px', cursor: 'pointer',
        padding: '5px 6px', lineHeight: 1,
        color: hov ? (danger ? 'var(--red)' : 'var(--teal)') : 'var(--muted)',
        transition: 'all .15s', display: 'flex', alignItems: 'center',
      }}
    >
      {children}
    </button>
  )
}

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        fontSize: '10px', color: 'var(--muted)', fontWeight: 700,
        display: 'block', marginBottom: '6px', letterSpacing: '.5px',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}
