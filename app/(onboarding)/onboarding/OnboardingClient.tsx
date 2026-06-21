'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseCSVText } from '@/lib/calculations'
import { Cpu, ChevronRight, Check, Upload, Plus, MapPin } from 'lucide-react'

interface Props {
  accountId: string
  fullName: string
  userId: string
}

const TOTAL_STEPS = 4

const INDUSTRIES = [
  { value: 'vending',   label: 'Vending / Automaten' },
  { value: 'catering',  label: 'Catering / Gastronomie' },
  { value: 'retail',    label: 'Einzelhandel' },
  { value: 'other',     label: 'Andere' },
]

// ── Progress Bar ──────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--teal)' }}>
          Schritt {step} von {TOTAL_STEPS}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {Math.round((step / TOTAL_STEPS) * 100)}%
        </span>
      </div>
      <div style={{ height: '4px', background: 'var(--s3)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '99px',
          width: `${(step / TOTAL_STEPS) * 100}%`,
          background: 'linear-gradient(90deg, #38bdf8, #34d399)',
          transition: 'width .4s ease',
        }} />
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label)', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '5px' }}>{hint}</div>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
  borderRadius: '10px', color: 'var(--text)', fontSize: '15px',
  padding: '12px 14px', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .15s',
}

// ── Main Component ────────────────────────────────────────────

export default function OnboardingClient({ accountId, fullName, userId }: Props) {
  const router = useRouter()
  const [step, setStep]       = useState(1)
  const [saving, setSaving]   = useState(false)

  // Step 1
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry]       = useState('vending')

  // Step 2
  const [machineMode, setMachineMode] = useState<'csv' | 'manual' | null>(null)
  const [machineName, setMachineName] = useState('')
  const [standort, setStandort]       = useState('')
  const [baselineRev, setBaselineRev] = useState('')
  const [csvMachines, setCsvMachines] = useState<Array<{ name: string; standort: string; rev: number }>>([])
  const [csvFileName, setCsvFileName] = useState('')

  // Step 3
  const [weRate, setWeRate]     = useState(28)
  const [fixCost, setFixCost]   = useState('50')
  const [miete, setMiete]       = useState('')

  // Step 4 (done summary)
  const [machineCount, setMachineCount] = useState(0)

  // ── Step 1 Save: Firma ──
  async function saveStep1() {
    if (!companyName.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('accounts').update({ name: companyName.trim(), industry }).eq('id', accountId)
    setSaving(false)
    setStep(2)
  }

  // ── Step 2: CSV parse ──
  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSVText(ev.target?.result as string)
      setCsvMachines(rows.map(r => ({ name: r.name, standort: '', rev: r.rev })))
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  // ── Step 2 Save: Maschinen ──
  async function saveStep2() {
    setSaving(true)
    const supabase = createClient()

    if (machineMode === 'manual' && machineName.trim()) {
      // Create one location if standort given
      let locationId: string | null = null
      if (standort.trim()) {
        const { data: loc } = await supabase.from('locations').insert({
          account_id: accountId, name: standort.trim(), miete: parseFloat(miete) || 0,
        }).select('id').single()
        locationId = loc?.id ?? null
      }
      await supabase.from('machines').insert({
        account_id: accountId, name: machineName.trim(),
        standort: standort.trim() || 'Standort 1',
        location_id: locationId,
        baseline_rev: parseFloat(baselineRev) || 0,
        baseline_tx: 0,
      })
      setMachineCount(1)
    } else if (machineMode === 'csv' && csvMachines.length > 0) {
      const inserts = csvMachines.map((m, i) => ({
        account_id: accountId, name: m.name,
        standort: m.standort || 'Standort 1',
        baseline_rev: m.rev, baseline_tx: 0, sort_order: i,
      }))
      await supabase.from('machines').insert(inserts)
      setMachineCount(csvMachines.length)
    }

    setSaving(false)
    setStep(3)
  }

  // ── Step 3 Save: Kosten ──
  async function saveStep3() {
    setSaving(true)
    const supabase = createClient()

    // Update fleet_settings
    await supabase.from('fleet_settings')
      .update({ we_rate: weRate / 100, variable_costs: parseFloat(fixCost) || 0 })
      .eq('account_id', accountId)

    // If manual machine + miete, update first machine's miete
    if (machineMode === 'manual' && machineName.trim() && miete) {
      await supabase.from('machines')
        .update({ miete: parseFloat(miete) || 0 })
        .eq('account_id', accountId)
        .eq('name', machineName.trim())
    }

    setSaving(false)
    setStep(4)
  }

  // ── Step 4: Complete ──
  async function complete() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId)
    setSaving(false)
    router.push('/dashboard?onboarding=done')
  }

  // ── Render ──
  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>

      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '48px', height: '48px', margin: '0 auto 12px',
          background: 'linear-gradient(135deg, #38bdf8 0%, #1680b0 100%)',
          borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(56,189,248,0.20)',
        }}>
          <Cpu size={22} color="#fff" strokeWidth={2} />
        </div>
        <div style={{
          fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg, #38bdf8, #93e8ff)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          VendoAI
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '28px 24px',
      }}>
        <ProgressBar step={step} />

        {/* ── SCHRITT 1: Firma ── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
              Willkommen{fullName ? `, ${fullName.split(' ')[0]}` : ''}! 👋
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Richte deinen Workspace in 4 Schritten ein. Dauert unter 3 Minuten.
            </p>

            <Field label="Firmenname *">
              <input
                style={inputStyle}
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="z.B. Müller Vending GmbH"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && companyName.trim() && saveStep1()}
                onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </Field>

            <Field label="Branche">
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {INDUSTRIES.map(i => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </Field>

            <button
              onClick={saveStep1}
              disabled={!companyName.trim() || saving}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                cursor: companyName.trim() ? 'pointer' : 'not-allowed',
                background: 'var(--teal)', color: '#0a1628',
                fontWeight: 800, fontSize: '15px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                opacity: (!companyName.trim() || saving) ? 0.6 : 1,
                transition: 'opacity .15s',
              }}
            >
              {saving ? 'Speichern…' : <>Weiter <ChevronRight size={17} /></>}
            </button>
          </div>
        )}

        {/* ── SCHRITT 2: Maschinen ── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>Erste Maschine hinzufügen</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Lade eine CSV-Datei hoch oder trage deine erste Maschine manuell ein.
            </p>

            {/* Mode picker */}
            {machineMode === null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={() => setMachineMode('csv')}
                  style={{
                    padding: '16px', borderRadius: '12px', cursor: 'pointer',
                    background: 'var(--s2)', border: '1px solid var(--border)',
                    textAlign: 'left', transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.4)'; (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--s2)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Upload size={20} color="var(--teal)" />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>CSV-Datei hochladen</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Televend, Nayax oder eigenes Format — alle Maschinen auf einmal</div>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                  </div>
                </button>

                <button
                  onClick={() => setMachineMode('manual')}
                  style={{
                    padding: '16px', borderRadius: '12px', cursor: 'pointer',
                    background: 'var(--s2)', border: '1px solid var(--border)',
                    textAlign: 'left', transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.4)'; (e.currentTarget as HTMLElement).style.background = 'var(--s3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--s2)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Plus size={20} color="var(--green)" />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>Manuell eingeben</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Eine Maschine jetzt, weitere später</div>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                  </div>
                </button>
              </div>
            )}

            {/* CSV mode */}
            {machineMode === 'csv' && (
              <div>
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '10px', padding: '28px', borderRadius: '12px', cursor: 'pointer',
                  border: '2px dashed var(--border)', background: 'var(--s2)',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.4)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <Upload size={28} color="var(--muted)" />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>
                      {csvFileName || 'CSV-Datei auswählen'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>.csv oder .txt</div>
                  </div>
                  <input type="file" accept=".csv,.txt" onChange={handleCsvFile} style={{ display: 'none' }} />
                </label>

                {csvMachines.length > 0 && (
                  <div style={{ marginTop: '14px', background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.20)', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)', marginBottom: '8px' }}>
                      ✓ {csvMachines.length} Maschinen erkannt
                    </div>
                    {csvMachines.slice(0, 3).map((m, i) => (
                      <div key={i} style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '3px' }}>
                        · {m.name} — € {m.rev.toFixed(2)}/Mo
                      </div>
                    ))}
                    {csvMachines.length > 3 && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>… und {csvMachines.length - 3} weitere</div>
                    )}
                  </div>
                )}

                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px', marginTop: '10px', padding: '4px 0' }}
                  onClick={() => { setMachineMode(null); setCsvMachines([]); setCsvFileName('') }}
                >
                  ← Zurück zur Auswahl
                </button>
              </div>
            )}

            {/* Manual mode */}
            {machineMode === 'manual' && (
              <div>
                <Field label="Maschinenname *">
                  <input
                    style={inputStyle} value={machineName}
                    onChange={e => setMachineName(e.target.value)}
                    placeholder="z.B. Snackbox Eingang"
                    autoFocus
                    onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </Field>
                <Field label="Standort" hint="Wo steht die Maschine?">
                  <div style={{ position: 'relative' }}>
                    <MapPin size={15} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      style={{ ...inputStyle, paddingLeft: '34px' }} value={standort}
                      onChange={e => setStandort(e.target.value)}
                      placeholder="z.B. Bahnhof Wien Mitte"
                      onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    />
                  </div>
                </Field>
                <Field label="Umsatz pro Monat (ca.)" hint="Schätzung reicht — du kannst es jederzeit ändern">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '15px' }}>€</span>
                    <input
                      type="number" style={{ ...inputStyle, paddingLeft: '28px' }} value={baselineRev}
                      onChange={e => setBaselineRev(e.target.value)}
                      placeholder="800"
                      onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    />
                  </div>
                </Field>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px', marginBottom: '16px', padding: '4px 0' }}
                  onClick={() => setMachineMode(null)}
                >
                  ← Zurück zur Auswahl
                </button>
              </div>
            )}

            {/* Buttons */}
            {machineMode !== null && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  onClick={() => { setStep(3); setMachineCount(0) }}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                >
                  Überspringen
                </button>
                <button
                  onClick={saveStep2}
                  disabled={saving || (machineMode === 'manual' && !machineName.trim()) || (machineMode === 'csv' && csvMachines.length === 0)}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
                    background: 'var(--teal)', color: '#0a1628',
                    fontWeight: 800, fontSize: '14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Speichern…' : <>Weiter <ChevronRight size={17} /></>}
                </button>
              </div>
            )}

            {machineMode === null && (
              <button
                onClick={() => { setStep(3); setMachineCount(0) }}
                style={{ width: '100%', marginTop: '16px', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}
              >
                Überspringen — später hinzufügen
              </button>
            )}
          </div>
        )}

        {/* ── SCHRITT 3: Kosten ── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>Kosten & Wareneinsatz</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Diese Werte fließen in alle Profit-Berechnungen ein. Schätzungen reichen.
            </p>

            {/* WE-Rate Slider */}
            <Field label={`Wareneinsatz (WE): ${weRate}%`} hint="Wie viel % des Umsatzes sind Warenkosten? Typisch: 25–35%">
              <div style={{ padding: '8px 0' }}>
                <input
                  type="range" min={10} max={60} step={1} value={weRate}
                  onChange={e => setWeRate(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--teal)', cursor: 'pointer', height: '6px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>10% (sehr günstig)</span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>60% (teuer)</span>
                </div>
              </div>
              {/* Visual feedback */}
              <div style={{
                marginTop: '8px', padding: '10px 14px', borderRadius: '8px',
                background: weRate <= 28 ? 'rgba(52,211,153,0.08)' : weRate <= 35 ? 'rgba(251,191,36,0.08)' : 'rgba(248,113,113,0.08)',
                border: `1px solid ${weRate <= 28 ? 'rgba(52,211,153,0.20)' : weRate <= 35 ? 'rgba(251,191,36,0.20)' : 'rgba(248,113,113,0.20)'}`,
                fontSize: '12px',
                color: weRate <= 28 ? 'var(--green)' : weRate <= 35 ? 'var(--yellow)' : 'var(--red)',
              }}>
                {weRate <= 25 ? '✓ Sehr günstig — guter Einkauf' : weRate <= 30 ? '✓ Gut — branchtypisch' : weRate <= 40 ? '⚠ Mittel — Verhandlungspotenzial' : '⚠ Hoch — Lieferant neu verhandeln'}
              </div>
            </Field>

            <Field label="Fixkosten pro Maschine (€/Monat)" hint="Wartung, Service, Strom — ohne Miete">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>€</span>
                <input
                  type="number" style={{ ...inputStyle, paddingLeft: '28px' }} value={fixCost}
                  onChange={e => setFixCost(e.target.value)}
                  placeholder="50"
                  onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </Field>

            <Field label="Miete pro Standort (optional, €/Monat)">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>€</span>
                <input
                  type="number" style={{ ...inputStyle, paddingLeft: '28px' }} value={miete}
                  onChange={e => setMiete(e.target.value)}
                  placeholder="0 (optional)"
                  onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </Field>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep(4)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                Überspringen
              </button>
              <button
                onClick={saveStep3}
                disabled={saving}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'var(--teal)', color: '#0a1628',
                  fontWeight: 800, fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Speichern…' : <>Weiter <ChevronRight size={17} /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── SCHRITT 4: Fertig ── */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', margin: '0 auto 20px',
              borderRadius: '50%', background: 'rgba(52,211,153,0.12)',
              border: '2px solid rgba(52,211,153,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={34} color="var(--green)" strokeWidth={2.5} />
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '10px' }}>Alles bereit! 🎉</h2>

            <div style={{
              background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px 18px', marginBottom: '24px', textAlign: 'left',
            }}>
              {machineCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                  <span style={{ fontSize: '13px' }}>{machineCount} Maschine{machineCount !== 1 ? 'n' : ''} geladen</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: '13px' }}>WE-Rate auf {weRate}% konfiguriert</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--teal)', fontWeight: 700 }}>⚡</span>
                <span style={{ fontSize: '13px', color: 'var(--label)' }}>KI analysiert deine Flotte…</span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Dein Dashboard ist jetzt aktiv. Du kannst jederzeit weitere Maschinen, Standorte und Kosten ergänzen.
            </p>

            <button
              onClick={complete}
              disabled={saving}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                cursor: 'pointer', background: 'linear-gradient(135deg, #38bdf8, #1680b0)',
                color: '#fff', fontWeight: 800, fontSize: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: '0 4px 20px rgba(56,189,248,0.25)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Wird gestartet…' : <>Zum Dashboard <ChevronRight size={18} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
