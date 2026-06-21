'use client'

import { useState } from 'react'
import type { Machine } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

const MONTHS = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

interface SnapshotModalProps {
  machines: Machine[]
  accountId: string
  onDone: () => void
  onClose: () => void
}

export default function SnapshotModal({ machines, accountId, onDone, onClose }: SnapshotModalProps) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year,  setYear]  = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]
  const label = `${MONTHS[month]} ${year}`

  async function save() {
    setSaving(true)
    const supabase = createClient()

    const upserts = machines.map(m => ({
      account_id:  accountId,
      machine_id:  m.id,
      month_label: label,
      rev: m.rev_override ?? m.baseline_rev,
      tx:  m.tx_override  ?? m.baseline_tx,
    }))

    await Promise.all(upserts.map(u =>
      supabase.from('snapshots').upsert(u, { onConflict: 'machine_id,month_label' })
    ))

    setSaving(false)
    setDone(true)
    setTimeout(() => { onDone(); onClose() }, 1200)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{
        background: 'var(--s1)', borderRadius: '16px',
        padding: '28px 32px', width: '360px', maxWidth: '95vw',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>Snapshot gespeichert!</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '6px' }}>{label}</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>📸 Snapshot erstellen</h2>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '20px' }}>
              Speichert die aktuellen Umsatzdaten aller {machines.length} Maschinen für den gewählten Monat.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '6px', letterSpacing: '.4px' }}>
                  MONAT
                </label>
                <select
                  className="input"
                  value={month}
                  onChange={e => setMonth(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '6px', letterSpacing: '.4px' }}>
                  JAHR
                </label>
                <select
                  className="input"
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{
              background: 'var(--s2)', borderRadius: '8px', padding: '12px 16px',
              marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Monat-Label:</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--blue)' }}>{label}</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
                {saving ? 'Wird gespeichert…' : '📸 Snapshot speichern'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
