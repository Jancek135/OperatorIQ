'use client'

import Link from 'next/link'

interface LagerKPIs {
  lagerwert: number
  totesKapital: number
  baldLeer: number
}

interface Props {
  kpis: LagerKPIs
}

export default function LagerKPISection({ kpis }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Lager-Übersicht
        </h2>
        <Link href="/lager" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', opacity: 0.8 }}>
          Zum Lager →
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {/* Lagerwert */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.9) 100%)',
          border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.05), 0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>💰</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Lagerwert
            </span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-1px' }}>
            {fmt(kpis.lagerwert)}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
            Gebundenes Kapital im Lager
          </div>
        </div>

        {/* Totes Kapital */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.9) 100%)',
          border: `1px solid ${kpis.totesKapital > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.1)'}`,
          borderRadius: '12px',
          padding: '20px',
          boxShadow: kpis.totesKapital > 0
            ? '0 0 0 1px rgba(239,68,68,0.1), 0 4px 24px rgba(0,0,0,0.3)'
            : '0 0 0 1px rgba(99,102,241,0.05), 0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>🔴</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Totes Kapital
            </span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: kpis.totesKapital > 0 ? '#f87171' : '#e2e8f0', letterSpacing: '-1px' }}>
            {fmt(kpis.totesKapital)}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
            Keine Bewegung seit 30+ Tagen
          </div>
        </div>

        {/* Bald leer */}
        <Link href="/lager" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.9) 100%)',
            border: `1px solid ${kpis.baldLeer > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(148,163,184,0.1)'}`,
            borderRadius: '12px',
            padding: '20px',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            boxShadow: kpis.baldLeer > 0
              ? '0 0 0 1px rgba(245,158,11,0.1), 0 4px 24px rgba(0,0,0,0.3)'
              : '0 0 0 1px rgba(99,102,241,0.05), 0 4px 24px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Bald leer
              </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: kpis.baldLeer > 0 ? '#fbbf24' : '#e2e8f0', letterSpacing: '-1px' }}>
              {kpis.baldLeer} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>Produkte</span>
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
              Unter Mindestbestand → jetzt bestellen
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
