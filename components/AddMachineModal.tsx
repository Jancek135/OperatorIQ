'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  accountId: string
  onClose: () => void
  onDone: () => void
}

export default function AddMachineModal({ accountId, onClose, onDone }: Props) {
  const [name, setName]             = useState('')
  const [standort, setStandort]     = useState('')
  const [miete, setMiete]           = useState('')
  const [baselineRev, setBaseRev]   = useState('')
  const [baselineTx, setBaseTx]     = useState('')
  const [fixCost, setFixCost]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Insert machine
    const { data: machine, error: mErr } = await supabase
      .from('machines')
      .insert({
        account_id:   accountId,
        name:         name.trim(),
        standort:     standort.trim(),
        miete:        parseFloat(miete) || 0,
        baseline_rev: parseFloat(baselineRev) || 0,
        baseline_tx:  parseInt(baselineTx) || 0,
      })
      .select()
      .single()

    if (mErr || !machine) {
      setError(mErr?.message ?? 'Fehler beim Speichern')
      setLoading(false)
      return
    }

    // Insert fix cost if provided
    if (fixCost) {
      await supabase.from('machine_costs').insert({
        machine_id: machine.id,
        fix_cost:   parseFloat(fixCost) || 0,
      })
    }

    setLoading(false)
    onDone()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Neue Maschine</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="NAME *" required>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Automat Wien Hauptbahnhof" required />
          </Field>

          <Field label="STANDORT">
            <input className="input" value={standort} onChange={e => setStandort(e.target.value)} placeholder="z.B. Wien Innenstadt" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="BASELINE UMSATZ (€)">
              <input className="input" type="number" step="0.01" value={baselineRev} onChange={e => setBaseRev(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="BASELINE TX">
              <input className="input" type="number" value={baselineTx} onChange={e => setBaseTx(e.target.value)} placeholder="0" />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="MIETE (€/Monat)">
              <input className="input" type="number" step="0.01" value={miete} onChange={e => setMiete(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="FIXKOSTEN (€/Monat)">
              <input className="input" type="number" step="0.01" value={fixCost} onChange={e => setFixCost(e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          {error && (
            <div style={{ background: 'var(--rdim)', color: 'var(--red)', padding: '10px 14px', borderRadius: '7px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
              {loading ? 'Wird gespeichert…' : '+ Maschine anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '6px', letterSpacing: '.4px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
