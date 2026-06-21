'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import type { Machine } from '@/lib/types'
import { fuzzyMatch } from '@/lib/calculations'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle2, AlertTriangle, X, ChevronDown, FileText, ArrowRight } from 'lucide-react'

interface Props {
  machines: Machine[]
  accountId: string
  onImportDone: () => void
}

// ── Types ──────────────────────────────────────────────────────

interface MatchedRow {
  csvName: string
  rev: number
  tx: number
  machine: Machine
  location: string
}

interface UnmatchedRow {
  csvName: string
  rev: number
  tx: number
  lineNumber: number
  reason: string
  selectedMachine: Machine | null
}

interface ParseError {
  lineNumber: number
  raw: string
  reason: string
}

type Step = 'idle' | 'review' | 'importing' | 'done'

// ── Column keyword detection ────────────────────────────────────

const NAME_KEYWORDS  = ['name', 'bezeichnung', 'maschine', 'gerät', 'machine', 'device', 'terminal', 'standort']
const REV_KEYWORDS   = ['umsatz', 'revenue', 'betrag', 'summe', 'erlös', 'einnahme', 'amount', 'total', 'netto', 'brutto']
const TX_KEYWORDS    = ['transaktion', 'transakt', 'verkauf', 'anzahl', 'count', 'vend', 'tx', 'käufe']

function findColIdx(headers: string[], keywords: string[]): number {
  return headers.findIndex(h => keywords.some(k => h.includes(k)))
}

function parseRev(raw: string): number {
  // Handles "1.234,56" (de-AT) and "1,234.56" (en-US)
  const cleaned = raw.replace(/[€$\s]/g, '').trim()
  const isDE = /\d+\.\d{3},/.test(cleaned) || (cleaned.includes(',') && !cleaned.includes('.'))
  if (isDE) return parseFloat(cleaned.replace('.', '').replace(',', '.')) || 0
  return parseFloat(cleaned.replace(',', '')) || 0
}

function germanReason(csvName: string, hasRev: boolean, hasName: boolean): string {
  if (!hasName) return 'Kein Maschinenname in dieser Zeile gefunden'
  if (!hasRev)  return `"${csvName}" hat keinen gültigen Umsatz`
  return `"${csvName}" konnte keiner Maschine zugeordnet werden`
}

// ── Main Component ──────────────────────────────────────────────

export default function CSVImport({ machines, accountId, onImportDone }: Props) {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [step, setStep]           = useState<Step>('idle')
  const [matched, setMatched]     = useState<MatchedRow[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([])
  const [errors, setErrors]       = useState<ParseError[]>([])
  const [importing, setImporting] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleClose() {
    if (step === 'importing') return
    setOpen(false)
    setStep('idle')
    setMatched([])
    setUnmatched([])
    setErrors([])
  }

  // ── Parse CSV ──
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (result) => {
        const rows = result.data as string[][]
        if (rows.length < 2) {
          setErrors([{ lineNumber: 0, raw: '', reason: 'Datei ist leer oder hat keine Datenzeilen.' }])
          setStep('review')
          return
        }

        const rawHeaders = rows[0].map(h => h.trim().toLowerCase().replace(/["']/g, ''))
        const nameIdx = findColIdx(rawHeaders, NAME_KEYWORDS)
        const revIdx  = findColIdx(rawHeaders, REV_KEYWORDS)
        const txIdx   = findColIdx(rawHeaders, TX_KEYWORDS)

        if (nameIdx < 0) {
          setErrors([{ lineNumber: 1, raw: rows[0].join(';'), reason: `Keine Namensspalte gefunden. Erkannte Spalten: ${rawHeaders.join(', ')}` }])
          setStep('review')
          return
        }
        if (revIdx < 0) {
          setErrors([{ lineNumber: 1, raw: rows[0].join(';'), reason: `Keine Umsatzspalte gefunden. Erkannte Spalten: ${rawHeaders.join(', ')}` }])
          setStep('review')
          return
        }

        const newMatched: MatchedRow[]     = []
        const newUnmatched: UnmatchedRow[] = []
        const newErrors: ParseError[]      = []

        rows.slice(1).forEach((cols, idx) => {
          const lineNumber = idx + 2
          const csvName = cols[nameIdx]?.trim().replace(/["']/g, '') ?? ''
          const rawRev  = cols[revIdx]?.trim().replace(/["']/g, '') ?? ''
          const rawTx   = txIdx >= 0 ? cols[txIdx]?.trim() ?? '0' : '0'

          if (!csvName) {
            newErrors.push({ lineNumber, raw: cols.join(';'), reason: 'Kein Maschinenname in dieser Zeile' })
            return
          }

          const rev = parseRev(rawRev)
          if (rev <= 0) {
            newUnmatched.push({
              csvName, rev: 0, tx: 0, lineNumber,
              reason: `Umsatz "${rawRev}" ist 0 oder ungültig`,
              selectedMachine: null,
            })
            return
          }

          const tx = parseInt(rawTx) || 0
          const machine = fuzzyMatch(csvName, machines)

          if (machine) {
            newMatched.push({ csvName, rev, tx, machine, location: machine.standort })
          } else {
            newUnmatched.push({
              csvName, rev, tx, lineNumber,
              reason: germanReason(csvName, true, true),
              selectedMachine: null,
            })
          }
        })

        setMatched(newMatched)
        setUnmatched(newUnmatched)
        setErrors(newErrors)
        setStep('review')
      },
      error: (err) => {
        setErrors([{ lineNumber: 0, raw: '', reason: `Datei konnte nicht gelesen werden: ${err.message}` }])
        setStep('review')
      },
    })

    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  // ── Import ──
  async function handleImport() {
    setImporting(true)
    const supabase = createClient()

    // Combine matched + manually assigned unmatched
    const toSave: Array<{ machineId: string; rev: number; tx: number }> = [
      ...matched.map(r => ({ machineId: r.machine.id, rev: r.rev, tx: r.tx })),
      ...unmatched
        .filter(r => r.selectedMachine)
        .map(r => ({ machineId: r.selectedMachine!.id, rev: r.rev, tx: r.tx })),
    ]

    // Deduplicate: if same machine appears twice, sum revenue
    const dedupMap = new Map<string, { rev: number; tx: number }>()
    for (const row of toSave) {
      const existing = dedupMap.get(row.machineId)
      if (existing) {
        dedupMap.set(row.machineId, { rev: existing.rev + row.rev, tx: existing.tx + row.tx })
      } else {
        dedupMap.set(row.machineId, { rev: row.rev, tx: row.tx })
      }
    }

    const upserts = Array.from(dedupMap.entries()).map(([machineId, { rev, tx }]) => ({
      account_id:  accountId,
      machine_id:  machineId,
      rev,
      tx,
      imported_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('rev_overrides')
      .upsert(upserts, { onConflict: 'machine_id' })

    setImporting(false)

    if (error) {
      setErrors(prev => [...prev, { lineNumber: 0, raw: '', reason: `Speicherfehler: ${error.message}` }])
      return
    }

    setImportCount(upserts.length)
    setStep('done')
    onImportDone()
  }

  function handleDone() {
    handleClose()
    router.push(`/dashboard?import=success&count=${importCount}`)
  }

  // ── Derived ──
  const uniqueLocations = [...new Set(matched.map(r => r.location).filter(Boolean))]
  const totalMatched    = matched.length + unmatched.filter(r => r.selectedMachine).length
  const stillUnmatched  = unmatched.filter(r => !r.selectedMachine)

  async function clearImport() {
    const supabase = createClient()
    await supabase.from('rev_overrides').delete().eq('account_id', accountId)
    onImportDone()
  }

  // ── Render ──
  return (
    <>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-ghost" onClick={() => { setOpen(true); setStep('idle') }}>
          <Upload size={14} style={{ marginRight: '6px' }} /> CSV Import
        </button>
        <button
          className="btn"
          style={{ background: 'var(--rdim)', color: 'var(--red)', fontSize: '12px', padding: '7px 12px' }}
          onClick={clearImport}
        >
          × Reset
        </button>
      </div>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,8,22,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <div style={{
            width: '100%', maxWidth: '600px', background: 'var(--s1)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-xl)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} color="var(--teal)" />
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800 }}>CSV Import</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Televend · Nayax · Eigenes Format</div>
                </div>
              </div>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', borderRadius: '6px', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

              {/* ── STEP: idle ── */}
              {step === 'idle' && (
                <div>
                  <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
                  <div
                    style={{
                      border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)',
                      padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                      transition: 'border-color .15s',
                    }}
                    onClick={() => fileRef.current?.click()}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.4)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                  >
                    <Upload size={32} color="var(--muted)" style={{ marginBottom: '12px' }} />
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>CSV-Datei hier ablegen</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '20px' }}>oder klicken zum Auswählen (.csv, .txt)</div>
                    <button className="btn btn-primary" style={{ display: 'inline-flex', padding: '9px 20px' }}>
                      Datei auswählen
                    </button>
                  </div>

                  <div style={{ marginTop: '20px', background: 'var(--s2)', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.7px', color: 'var(--muted)', marginBottom: '10px' }}>
                      ERKANNTE SPALTEN-KEYWORDS
                    </div>
                    {[
                      { label: 'Name', keys: NAME_KEYWORDS.slice(0, 5).join(', ') },
                      { label: 'Umsatz', keys: REV_KEYWORDS.slice(0, 5).join(', ') },
                      { label: 'TX', keys: TX_KEYWORDS.slice(0, 5).join(', ') },
                    ].map(({ label, keys }) => (
                      <div key={label} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--muted)', width: '50px', flexShrink: 0 }}>{label}:</span>
                        <code style={{ color: 'var(--label)', background: 'var(--s3)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>{keys}</code>
                      </div>
                    ))}
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                      Trennzeichen <code style={{ background: 'var(--s3)', padding: '1px 5px', borderRadius: '4px' }}>;</code> und{' '}
                      <code style={{ background: 'var(--s3)', padding: '1px 5px', borderRadius: '4px' }}>,</code> werden automatisch erkannt. Dezimalkomma und -punkt werden beide unterstützt.
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP: review ── */}
              {step === 'review' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Critical parse errors */}
                  {errors.length > 0 && matched.length === 0 && unmatched.length === 0 && (
                    <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <AlertTriangle size={16} color="var(--red)" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--red)' }}>Datei konnte nicht verarbeitet werden</div>
                      </div>
                      {errors.map((e, i) => (
                        <div key={i} style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '26px', marginBottom: '4px' }}>
                          {e.lineNumber > 0 && <span style={{ color: 'var(--muted)', marginRight: '6px' }}>Zeile {e.lineNumber}:</span>}
                          {e.reason}
                        </div>
                      ))}
                      <button className="btn btn-ghost" style={{ marginTop: '12px', fontSize: '12px', padding: '6px 14px' }} onClick={() => { setStep('idle'); setErrors([]) }}>
                        Andere Datei wählen
                      </button>
                    </div>
                  )}

                  {/* ✔ Summary */}
                  {(matched.length > 0 || unmatched.length > 0) && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: 'var(--muted)', marginBottom: '12px' }}>IMPORT-VORSCHAU</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <SummaryRow icon="✔" color="var(--green)"  label={`${matched.length} Maschine${matched.length !== 1 ? 'n' : ''} erkannt`}     active={matched.length > 0} />
                        <SummaryRow icon="✔" color="var(--teal)"   label={`${uniqueLocations.length} Standort${uniqueLocations.length !== 1 ? 'e' : ''} erkannt`} active={uniqueLocations.length > 0} />
                        {stillUnmatched.length > 0 && (
                          <SummaryRow icon="⚠" color="var(--yellow)" label={`${stillUnmatched.length} Zeile${stillUnmatched.length !== 1 ? 'n' : ''} konnten nicht zugeordnet werden → manuell auswählen`} active={false} />
                        )}
                        {errors.length > 0 && matched.length + unmatched.length > 0 && (
                          <SummaryRow icon="✕" color="var(--red)" label={`${errors.length} Zeile${errors.length !== 1 ? 'n' : ''} mit Fehler (werden übersprungen)`} active={false} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Matched preview */}
                  {matched.length > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.7px', color: 'var(--muted)', marginBottom: '8px' }}>ERKANNTE MASCHINEN</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                        {matched.map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--s2)', borderRadius: '8px', padding: '9px 12px', border: '1px solid rgba(52,211,153,0.15)' }}>
                            <CheckCircle2 size={14} color="var(--green)" style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: '12px', color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.csvName}</div>
                            <ArrowRight size={12} color="var(--muted)" style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{r.machine.name}</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--teal)', flexShrink: 0, minWidth: '70px', textAlign: 'right' }}>
                              € {r.rev.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unmatched — manual assignment */}
                  {unmatched.length > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.7px', color: 'var(--yellow)', marginBottom: '8px' }}>
                        NICHT ERKANNT — MASCHINE MANUELL ZUWEISEN
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {unmatched.map((r, i) => (
                          <div key={i} style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.20)', borderRadius: '8px', padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <AlertTriangle size={13} color="var(--yellow)" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', fontWeight: 700 }}>{r.csvName}</span>
                              <span style={{ fontSize: '11px', color: 'var(--yellow)', marginLeft: 'auto', flexShrink: 0 }}>€ {r.rev.toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>{r.reason}</div>
                            <select
                              value={r.selectedMachine?.id ?? ''}
                              onChange={e => {
                                const machine = machines.find(m => m.id === e.target.value) ?? null
                                setUnmatched(prev => prev.map((u, j) => j === i ? { ...u, selectedMachine: machine } : u))
                              }}
                              style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px', padding: '6px 10px', outline: 'none' }}
                            >
                              <option value="">— Maschine auswählen (optional) —</option>
                              {machines.map(m => (
                                <option key={m.id} value={m.id}>{m.name} — {m.standort}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row-level errors (non-critical) */}
                  {errors.length > 0 && (matched.length + unmatched.length) > 0 && (
                    <details style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '8px', padding: '10px 14px' }}>
                      <summary style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={13} />{errors.length} Zeile{errors.length !== 1 ? 'n' : ''} mit Fehler (werden übersprungen)
                        <ChevronDown size={13} style={{ marginLeft: 'auto' }} />
                      </summary>
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {errors.map((e, i) => (
                          <div key={i} style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            <span style={{ color: 'var(--red)', marginRight: '6px' }}>Zeile {e.lineNumber}:</span>{e.reason}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* ── STEP: done ── */}
              {step === 'done' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <CheckCircle2 size={32} color="var(--green)" />
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--green)', marginBottom: '8px' }}>Import erfolgreich</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '28px' }}>
                    {importCount} Maschine{importCount !== 1 ? 'n' : ''} aktualisiert · Daten sofort im Dashboard sichtbar
                  </div>
                  <button
                    onClick={handleDone}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'var(--green)', color: '#0a1628', fontWeight: 800, fontSize: '14px' }}
                  >
                    Zum Dashboard <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Footer — action buttons */}
            {(step === 'review' && (matched.length > 0 || unmatched.some(r => r.selectedMachine))) && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', flexShrink: 0 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setStep('idle'); setMatched([]); setUnmatched([]); setErrors([]) }}
                  style={{ flex: 1 }}
                >
                  Zurück
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  style={{
                    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '10px', borderRadius: '10px', border: 'none', cursor: importing ? 'wait' : 'pointer',
                    background: 'var(--teal)', color: '#0a1628', fontWeight: 800, fontSize: '14px',
                    opacity: importing ? 0.7 : 1,
                  }}
                >
                  {importing
                    ? 'Wird importiert…'
                    : <><CheckCircle2 size={16} /> {totalMatched} Maschine{totalMatched !== 1 ? 'n' : ''} importieren</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function SummaryRow({ icon, color, label, active }: { icon: string; color: string; label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
      <span style={{ color, fontWeight: 800, fontSize: '14px', width: '18px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: active ? 'var(--text)' : 'var(--label)', fontWeight: active ? 600 : 400 }}>{label}</span>
    </div>
  )
}
