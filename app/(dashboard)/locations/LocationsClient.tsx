'use client'

import Link from 'next/link'
import type { Location, Machine } from '@/lib/types'
import { getMRev, getMTx, fmtEur, fmtEur2 } from '@/lib/calculations'
import { MapPin, ChevronRight, Cpu } from 'lucide-react'

interface LocationSummary {
  loc: Location
  ms: Machine[]
  totalRev: number
  totalTx: number
  green: number
  yellow: number
  red: number
  share: number
}

interface Props {
  locationSummaries: LocationSummary[]
  fleetRev: number
  machineCount: number
}

export default function LocationsClient({ locationSummaries, fleetRev, machineCount }: Props) {
  return (
    <div style={{ padding: '40px 44px', maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)',
          }}>
            <MapPin size={17} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-1px' }}>Standorte</h1>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', paddingLeft: '46px' }}>
          {locationSummaries.length} Standorte · {machineCount} Maschinen · {fmtEur(fleetRev)} Gesamtumsatz
        </div>
      </div>

      {/* Location Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {locationSummaries.map(({ loc, ms, totalRev, totalTx, green, yellow, red, share }, i) => {
          const profitAfterMiete = totalRev - loc.miete
          return (
            <Link key={loc.id} href={`/locations/${loc.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card kpi-hover" style={{ padding: '22px 24px', cursor: 'pointer' }}>

                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                      background: i === 0 ? 'rgba(56,189,248,0.10)' : 'var(--s3)',
                      border: `1px solid ${i === 0 ? 'rgba(56,189,248,0.22)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: i === 0 ? 'var(--teal)' : 'var(--muted)',
                      fontSize: '13px', fontWeight: 800,
                    }}>
                      #{i + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '2px' }}>
                        {loc.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Cpu size={10} /> {ms.length} Maschine{ms.length !== 1 ? 'n' : ''}
                        </span>
                        {loc.adresse && <span>{loc.adresse}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px',
                        color: i === 0 ? 'var(--teal)' : 'var(--text)',
                      }}>
                        {fmtEur(totalRev)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{share.toFixed(1)}% der Flotte</div>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '3px', background: 'var(--s3)', borderRadius: '99px', marginBottom: '14px', overflow: 'hidden' }}>
                  <div className="progress-fill" style={{
                    height: '100%', borderRadius: '99px', width: `${share}%`,
                    background: i === 0 ? 'linear-gradient(90deg, #38bdf8, #1680b0)' : 'var(--s4)',
                  }} />
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  <StatPill label="TX" value={totalTx.toLocaleString('de-AT')} />
                  <StatPill label="Ø BON" value={totalTx > 0 ? fmtEur2(totalRev / totalTx) : '—'} />
                  {loc.miete > 0 && (
                    <StatPill
                      label="NACH MIETE"
                      value={fmtEur(profitAfterMiete)}
                      color={profitAfterMiete >= 0 ? 'var(--green)' : 'var(--red)'}
                    />
                  )}
                  <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                    {green  > 0 && <Badge label={`${green} TOP`}  color="var(--green)"  bg="rgba(52,211,153,0.09)"  border="rgba(52,211,153,0.20)" />}
                    {yellow > 0 && <Badge label={`${yellow} OK`}   color="var(--yellow)" bg="rgba(251,191,36,0.09)"  border="rgba(251,191,36,0.20)" />}
                    {red    > 0 && <Badge label={`${red} KRIT`}   color="var(--red)"    bg="rgba(248,113,113,0.09)" border="rgba(248,113,113,0.22)" />}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}

        {locationSummaries.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--muted)', fontSize: '13px',
            background: 'var(--s2)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)',
          }}>
            <MapPin size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <div style={{ fontWeight: 600 }}>Noch keine Standorte</div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.6px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: color ?? 'var(--label)' }}>{value}</div>
    </div>
  )
}

function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '.4px',
      color, background: bg, border: `1px solid ${border}`,
      borderRadius: '6px', padding: '3px 9px',
    }}>{label}</span>
  )
}
