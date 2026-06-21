'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Location, Machine, Snapshot, FleetSettings } from '@/lib/types'
import { getMRev, getMWE } from '@/lib/calculations'

interface Props {
  location: Location
  machines: Machine[]
  locationMachines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
}

const fmt = (n: number) =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export default function LocationDetailClient({ location, locationMachines, settings }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: location.name,
    adresse: location.adresse ?? '',
    ort: location.ort ?? '',
    plz: location.plz ?? '',
    ansprechpartner: location.ansprechpartner ?? '',
    telefon: location.telefon ?? '',
    miete: String(location.miete ?? 0),
    nebenkosten: String(location.nebenkosten ?? 0),
    vertrag_bis: location.vertrag_bis ?? '',
    notizen: location.notizen ?? '',
  })

  // KPIs
  const totalRev = locationMachines.reduce((s, m) => s + getMRev(m), 0)
  const totalWE = locationMachines.reduce((s, m) => s + getMRev(m) * getMWE(m, settings.we_rate), 0)
  const db1 = totalRev - totalWE
  const fixCosts = locationMachines.reduce((s, m) => s + (m.fix_cost ?? 0), 0)
  const miete = location.miete ?? 0
  const nebenkosten = (location as any).nebenkosten ?? 0
  const totalFix = fixCosts + miete + nebenkosten
  const db2 = db1 - totalFix
  const roi = totalFix > 0 ? (db2 / totalFix) * 100 : null

  // KI-Score (0–100)
  const marginPct = totalRev > 0 ? db2 / totalRev : 0
  const kiScore = Math.max(0, Math.min(100, Math.round(50 + marginPct * 200)))
  const kiColor = kiScore >= 60 ? '#22c55e' : kiScore >= 40 ? '#eab308' : '#ef4444'
  const kiLabel = kiScore >= 60 ? 'Stark' : kiScore >= 40 ? 'Mittel' : 'Schwach'

  // Vertragsablauf
  const today = new Date()
  const vertragDate = location.vertrag_bis ? new Date(location.vertrag_bis) : null
  const daysToExpiry = vertragDate
    ? Math.ceil((vertragDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const showExpiryAlert = daysToExpiry !== null && daysToExpiry <= 90

  const circumference = 2 * Math.PI * 38
  const offset = circumference - (kiScore / 100) * circumference

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('locations')
      .update({
        name: form.name,
        adresse: form.adresse || null,
        ort: form.ort || null,
        plz: form.plz || null,
        ansprechpartner: form.ansprechpartner || null,
        telefon: form.telefon || null,
        miete: parseFloat(form.miete) || 0,
        nebenkosten: parseFloat(form.nebenkosten) || 0,
        vertrag_bis: form.vertrag_bis || null,
        notizen: form.notizen || null,
      } as any)
      .eq('id', location.id)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <button
            onClick={() => router.push('/locations')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, marginBottom: 8, padding: 0 }}
          >
            &larr; Alle Standorte
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{location.name}</h1>
          {location.adresse && (
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
              {location.adresse}
              {(location.plz || location.ort) && ', '}
              {location.plz} {location.ort}
            </p>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          Bearbeiten
        </button>
      </div>

      {/* Vertragsablauf Alert */}
      {showExpiryAlert && (
        <div style={{
          background: daysToExpiry! <= 30 ? '#7f1d1d' : '#78350f',
          border: '1px solid ' + (daysToExpiry! <= 30 ? '#dc2626' : '#d97706'),
          borderRadius: 10, padding: '12px 16px', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>&#9888;</span>
          <div>
            <strong style={{ color: '#fef2f2', fontSize: 14 }}>
              Vertragsablauf in {daysToExpiry} Tagen
            </strong>
            <p style={{ color: '#fca5a5', fontSize: 13, margin: '2px 0 0' }}>
              Vertrag laeuft am {vertragDate!.toLocaleDateString('de-AT')} ab
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards + KI-Score */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>Umsatz / Monat</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(totalRev)}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{locationMachines.length} Maschinen</div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>DB2 / Monat</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: db2 >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(db2)}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>nach Miete + Nebenkosten</div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>ROI</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: roi !== null && roi >= 0 ? '#22c55e' : '#ef4444' }}>
            {roi !== null ? roi.toFixed(0) + '%' : '—'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>DB2 / Fixkosten</div>
        </div>
        {/* KI-Score Ring */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8 }}>KI-Score</div>
          <svg width={96} height={96} viewBox="0 0 96 96">
            <circle cx={48} cy={48} r={38} fill="none" stroke="var(--border)" strokeWidth={8} />
            <circle
              cx={48} cy={48} r={38} fill="none"
              stroke={kiColor} strokeWidth={8} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              transform="rotate(-90 48 48)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x={48} y={52} textAnchor="middle" fill={kiColor} fontSize={18} fontWeight={700}>{kiScore}</text>
          </svg>
          <div style={{ color: kiColor, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{kiLabel}</div>
        </div>
      </div>

      {/* Waterfall */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 24, marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Ertrags-Waterfall</h3>
        <WaterfallRow label="Umsatz" value={totalRev} base={totalRev} color="#3b82f6" />
        <WaterfallRow label={'Warenentnahme (' + (settings.we_rate * 100).toFixed(0) + '%)'} value={-totalWE} base={totalRev} color="#f97316" />
        <WaterfallRow label="= DB1" value={db1} base={totalRev} color="#8b5cf6" isSubtotal />
        <WaterfallRow label={'Miete (' + fmt(miete) + ')'} value={-miete} base={totalRev} color="#ef4444" />
        {nebenkosten > 0 && (
          <WaterfallRow label={'Nebenkosten (' + fmt(nebenkosten) + ')'} value={-nebenkosten} base={totalRev} color="#ef4444" />
        )}
        {fixCosts > 0 && (
          <WaterfallRow label={'Maschinenkosten (' + fmt(fixCosts) + ')'} value={-fixCosts} base={totalRev} color="#ef4444" />
        )}
        <WaterfallRow label="= DB2 (Standort-Gewinn)" value={db2} base={totalRev} color={db2 >= 0 ? '#22c55e' : '#ef4444'} isSubtotal isEnd />
      </div>

      {/* Maschinen */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 24, marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          Maschinen ({locationMachines.length})
        </h3>
        {locationMachines.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Keine Maschinen zugeordnet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px 6px 0' }}>Maschine</th>
                <th style={{ textAlign: 'right', padding: '6px 0' }}>Umsatz</th>
                <th style={{ textAlign: 'right', padding: '6px 0' }}>WE</th>
                <th style={{ textAlign: 'right', padding: '6px 0' }}>DB1</th>
              </tr>
            </thead>
            <tbody>
              {locationMachines.map(m => {
                const rev = getMRev(m)
                const we = rev * getMWE(m, settings.we_rate)
                const d1 = rev - we
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push('/machines/' + m.id)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '10px 12px 10px 0', color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</td>
                    <td style={{ textAlign: 'right', padding: '10px 0', color: 'var(--text-primary)' }}>{fmt(rev)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 0', color: '#f97316' }}>{'-' + fmt(we)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 0', color: d1 >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{fmt(d1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Details */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Standort-Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DetailRow label="Ansprechpartner" value={location.ansprechpartner} />
          <DetailRow label="Telefon" value={location.telefon} />
          <DetailRow label="Miete" value={fmt(location.miete)} />
          <DetailRow label="Nebenkosten" value={nebenkosten > 0 ? fmt(nebenkosten) : null} />
          <DetailRow label="Vertrag bis" value={location.vertrag_bis ? new Date(location.vertrag_bis).toLocaleDateString('de-AT') : null} />
          <DetailRow label="Notizen" value={location.notizen} />
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Standort bearbeiten</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} colSpan={2} />
              <FormField label="Adresse" value={form.adresse} onChange={v => setForm(f => ({ ...f, adresse: v }))} colSpan={2} />
              <FormField label="PLZ" value={form.plz} onChange={v => setForm(f => ({ ...f, plz: v }))} />
              <FormField label="Ort" value={form.ort} onChange={v => setForm(f => ({ ...f, ort: v }))} />
              <FormField label="Ansprechpartner" value={form.ansprechpartner} onChange={v => setForm(f => ({ ...f, ansprechpartner: v }))} />
              <FormField label="Telefon" value={form.telefon} onChange={v => setForm(f => ({ ...f, telefon: v }))} />
              <FormField label="Miete (EUR/Monat)" type="number" value={form.miete} onChange={v => setForm(f => ({ ...f, miete: v }))} />
              <FormField label="Nebenkosten (EUR/Monat)" type="number" value={form.nebenkosten} onChange={v => setForm(f => ({ ...f, nebenkosten: v }))} />
              <FormField label="Vertrag bis (YYYY-MM-DD)" value={form.vertrag_bis} onChange={v => setForm(f => ({ ...f, vertrag_bis: v }))} colSpan={2} />
              <FormField label="Notizen" value={form.notizen} onChange={v => setForm(f => ({ ...f, notizen: v }))} colSpan={2} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={handleSave} disabled={saving}
                style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, cursor: 'pointer' }}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 0', cursor: 'pointer' }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WaterfallRow({ label, value, base, color, isSubtotal, isEnd }: {
  label: string; value: number; base: number; color: string
  isSubtotal?: boolean; isEnd?: boolean
}) {
  const barW = base > 0 ? Math.min(100, (Math.abs(value) / base) * 100) : 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
      borderBottom: isEnd ? '2px solid var(--border)' : '1px solid var(--border)',
      borderTop: isSubtotal ? '1px solid var(--border)' : undefined,
    }}>
      <div style={{ width: 220, fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: barW + '%', height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <div style={{ width: 100, textAlign: 'right', fontWeight: isSubtotal || isEnd ? 700 : 400, fontSize: 14, color, flexShrink: 0 }}>
        {value < 0 ? '-' : ''}{fmt(Math.abs(value))}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: 14 }}>{value || '—'}</div>
    </div>
  )
}

function FormField({ label, value, onChange, type = 'text', colSpan }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; colSpan?: number
}) {
  return (
    <div style={{ gridColumn: colSpan === 2 ? 'span 2' : undefined }}>
      <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
      />
    </div>
  )
}
