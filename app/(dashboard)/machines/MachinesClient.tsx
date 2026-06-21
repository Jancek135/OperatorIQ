'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import { status } from '@/lib/calculations'
import MachineCard from '@/components/MachineCard'
import CSVImport from '@/components/CSVImport'
import AddMachineModal from '@/components/AddMachineModal'
import { createClient } from '@/lib/supabase/client'

type Filter = 'all' | 'g' | 'y' | 'r'

interface Props {
  machines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
  accountId: string
}

export default function MachinesClient({ machines, snapshots, settings, accountId }: Props) {
  const router = useRouter()
  const [filter, setFilter]     = useState<Filter>('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [snapMsg, setSnapMsg]   = useState('')
  const [, startTransition]     = useTransition()

  const sorted   = [...machines].sort((a, b) => (b.rev_override ?? b.baseline_rev) - (a.rev_override ?? a.baseline_rev))
  const filtered = filter === 'all' ? sorted : sorted.filter(m => status(m, machines, settings) === filter)

  const greenCount  = machines.filter(m => status(m, machines, settings) === 'g').length
  const yellowCount = machines.filter(m => status(m, machines, settings) === 'y').length
  const redCount    = machines.filter(m => status(m, machines, settings) === 'r').length

  async function saveSnapshot() {
    const supabase = createClient()
    const label = new Date().toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })
    await Promise.all(machines.map(m =>
      supabase.from('snapshots').upsert({
        account_id: accountId, machine_id: m.id, month_label: label,
        rev: m.rev_override ?? m.baseline_rev, tx: m.tx_override ?? m.baseline_tx,
      }, { onConflict: 'machine_id,month_label' })
    ))
    setSnapMsg('✓ Gespeichert!')
    setTimeout(() => setSnapMsg(''), 2500)
    startTransition(() => router.refresh())
  }

  return (
    <div className="page-pad" style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '3px' }}>Maschinen</h1>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{machines.length} Maschinen in der Fleet</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <CSVImport machines={machines} accountId={accountId} onImportDone={() => startTransition(() => router.refresh())} />
          <button className="btn btn-ghost" onClick={saveSnapshot}>{snapMsg || '📸 Snapshot'}</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Maschine hinzufügen</button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['all', 'g', 'y', 'r'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn ${filter === f ? (f === 'g' ? 'btn-success' : f === 'r' ? 'btn-danger' : 'btn-primary') : 'btn-ghost'}`}
            style={filter === f && f === 'y' ? { background: 'var(--ydim)', color: 'var(--yellow)' } : {}}
          >
            {f === 'all' ? `Alle (${machines.length})` : f === 'g' ? `✅ Top (${greenCount})` : f === 'y' ? `⚠️ OK (${yellowCount})` : `🔴 Kritisch (${redCount})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      {machines.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎰</div>
          <h3 style={{ marginBottom: '10px' }}>Keine Maschinen</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>Füge deine erste Maschine hinzu.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Erste Maschine</button>
        </div>
      ) : (
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
      )}

      {/* Add Machine Modal */}
      {showAdd && (
        <AddMachineModal
          accountId={accountId}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); startTransition(() => router.refresh()) }}
        />
      )}
    </div>
  )
}
