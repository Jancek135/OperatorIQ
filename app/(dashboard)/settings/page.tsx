'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, User, Shield, Database, DollarSign, Trash2, Save } from 'lucide-react'

type CostGroup = { label: string; icon: React.ReactNode; items: CostItem[] }
type CostItem  = { id: string; label: string; default: number }

const COST_GROUPS: CostGroup[] = [
  {
    label: 'Leasing', icon: <DollarSign size={14} />,
    items: [
      { id: 'f1',  label: 'Leasing DM9&SSX OD Ferlach',      default: 762  },
      { id: 'f2',  label: 'Leasing SMX OD#1 Ferlach/Schule',  default: 317  },
      { id: 'f3',  label: 'Leasing Candy Machine Ferlach',     default: 1290 },
      { id: 'f4',  label: 'Leasing DSHAKE OD Althofen',        default: 825  },
      { id: 'f5',  label: 'Leasing SMX24 Althofen',            default: 320  },
      { id: 'f11', label: 'Leasing Gänserndorf#1',             default: 191  },
      { id: 'f12', label: 'Leasing Gänserndorf#2',             default: 85   },
      { id: 'f13', label: 'Leasing KLU 24H',                   default: 150  },
    ],
  },
  {
    label: 'Miete (Standorte)', icon: <Database size={14} />,
    items: [
      { id: 'f6',  label: 'Maschinenmiete gesamt (Standorte)', default: 3359 },
      { id: 'f14', label: 'Standortmiete Gänserndorf',         default: 420  },
      { id: 'f15', label: 'Standortmiete Dampfvilla',          default: 720  },
      { id: 'f16', label: 'Standortmiete Klagenfurt 24H',      default: 1173 },
    ],
  },
  {
    label: 'Versicherung', icon: <Shield size={14} />,
    items: [{ id: 'f7', label: 'Versicherung (gesamt)', default: 702 }],
  },
  {
    label: 'Energie', icon: <DollarSign size={14} />,
    items: [
      { id: 'f8',  label: 'Strom Ferlach',    default: 354 },
      { id: 'f17', label: 'Strom Gänserndorf', default: 160 },
      { id: 'f26', label: 'Strom sonstige',    default: 50  },
    ],
  },
  {
    label: 'Personal', icon: <User size={14} />,
    items: [
      { id: 'f9a', label: 'Personalkosten (Mitarbeiter 1)', default: 500 },
      { id: 'f9b', label: 'Personalkosten (Mitarbeiter 2)', default: 300 },
      { id: 'f18', label: 'Personalkosten (extern)',         default: 300 },
    ],
  },
  {
    label: 'Software & IT', icon: <Database size={14} />,
    items: [
      { id: 'f19', label: 'Televend SaaS',          default: 300 },
      { id: 'f20', label: 'Office 365',             default: 28  },
      { id: 'f25', label: 'Buchhaltungssoftware',   default: 85  },
      { id: 'f21', label: 'VendoAI (diese App)',     default: 30  },
      { id: 'f27', label: 'Sonstige Software',      default: 30  },
      { id: 'f24', label: 'Domain & Hosting',       default: 20  },
      { id: 'f23', label: 'Marketing & Werbung',    default: 100 },
    ],
  },
  {
    label: 'Provisionen', icon: <DollarSign size={14} />,
    items: [
      { id: 'f22', label: 'Provision Reptilienzoo (10%)', default: 600 },
      { id: 'f10', label: 'Sonstige Provisionen',         default: 300 },
    ],
  },
  {
    label: 'Steuern & Sonstiges', icon: <Shield size={14} />,
    items: [{ id: 'f28', label: 'Steuerberatung & Abgaben', default: 200 }],
  },
]

const ALL_ITEMS = COST_GROUPS.flatMap(g => g.items)

function buildDefaultCostMap(): Record<string, string> {
  const m: Record<string, string> = {}
  ALL_ITEMS.forEach(i => { m[i.id] = i.default.toString() })
  return m
}

export default function SettingsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [weRate,      setWeRate]    = useState('35')
  const [varCosts,    setVarCosts]  = useState('160')
  const [accountName, setAccName]   = useState('')
  const [accountId,   setAccountId] = useState<string | null>(null)
  const [costs,       setCosts]     = useState<Record<string, string>>(buildDefaultCostMap)
  const [loading,     setLoading]   = useState(false)
  const [saved,       setSaved]     = useState(false)
  const [dataLoaded,  setDataLoaded] = useState(false)
  const [openGroups,  setOpenGroups] = useState<Record<string, boolean>>({})

  const totalFix = ALL_ITEMS.reduce((sum, item) => sum + (parseFloat(costs[item.id]) || 0), 0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('account_id, accounts(name)').eq('id', user.id).single()
      if (!profile) return
      setAccountId(profile.account_id)
      setAccName((profile.accounts as any)?.name ?? '')
      const { data: fs } = await supabase
        .from('fleet_settings').select('*').eq('account_id', profile.account_id).single()
      if (fs) {
        setWeRate((fs.we_rate * 100).toFixed(1))
        setVarCosts(fs.variable_costs?.toString() ?? '160')
        if (fs.cost_items && Array.isArray(fs.cost_items) && fs.cost_items.length > 0) {
          const loaded: Record<string, string> = buildDefaultCostMap()
          ;(fs.cost_items as { id: string; value: number }[]).forEach(({ id, value }) => {
            loaded[id] = value.toString()
          })
          setCosts(loaded)
        }
      }
      setDataLoaded(true)
    }
    load()
  }, [])

  const updateCost = useCallback((id: string, val: string) => {
    setCosts(prev => ({ ...prev, [id]: val }))
  }, [])

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId) return
    setLoading(true)
    const costItems = ALL_ITEMS.map(item => ({
      id: item.id, label: item.label, value: parseFloat(costs[item.id]) || 0,
    }))
    await supabase.from('fleet_settings').upsert({
      account_id: accountId, we_rate: parseFloat(weRate) / 100,
      total_fix: totalFix, variable_costs: parseFloat(varCosts) || 0,
      cost_items: costItems, updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id' })
    if (accountName) {
      await supabase.from('accounts').update({ name: accountName }).eq('id', accountId)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setLoading(false)
    router.refresh()
  }

  if (!dataLoaded) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚙️</div>
        Lade Einstellungen…
      </div>
    )
  }

  return (
    <div className="page-pad" style={{ padding: '40px 44px', maxWidth: '780px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: 'var(--r-md)',
            background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)',
          }}>
            <Shield size={17} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px' }}>Einstellungen</h1>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6, maxWidth: '480px' }}>
          Konfiguriere Wareneinsatz, Fixkosten und Unternehmensdaten für präzise Profit-Berechnungen.
        </p>
      </div>

      <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Konto */}
        <SettingsSection icon={<User size={16} />} title="Account Details" subtitle="Persönliche Informationen und Präferenzen">
          <Field label="FIRMENNAME">
            <input className="input" value={accountName} onChange={e => setAccName(e.target.value)} placeholder="Mein Betrieb GmbH" />
          </Field>
        </SettingsSection>

        {/* WE */}
        <SettingsSection icon={<DollarSign size={16} />} title="Wareneinsatz (WE)" subtitle="Standard-WE-Satz für die gesamte Fleet">
          <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '14px', lineHeight: 1.6 }}>
            Kann pro Maschine überschrieben werden (★ in der Maschinen-Card).
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              className="input" type="number" step="0.1" min="0" max="100"
              value={weRate} onChange={e => setWeRate(e.target.value)}
              style={{ width: '120px' }}
            />
            <span style={{ color: 'var(--label)', fontSize: '13px' }}>%</span>
            <span style={{
              background: 'var(--bdim)', color: 'var(--teal)',
              border: '1px solid rgba(56,189,248,0.18)',
              borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600,
            }}>
              = {(parseFloat(weRate) / 100).toFixed(3)} · Umsatz
            </span>
          </div>
        </SettingsSection>

        {/* Fixkosten */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: '20px 26px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(56,189,248,0.025) 0%, transparent 50%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '9px',
                background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--teal)',
              }}>
                <DollarSign size={16} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1px' }}>Fixkosten Management</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Wiederkehrende Ausgaben konfigurieren</div>
              </div>
            </div>
            <div style={{
              textAlign: 'right',
              background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.14)',
              borderRadius: 'var(--r-md)', padding: '8px 16px',
            }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '3px' }}>
                TOTAL / MONAT
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--teal)', letterSpacing: '-0.5px', lineHeight: 1 }}>
                {totalFix.toLocaleString('de-AT', { minimumFractionDigits: 0 })} €
              </div>
            </div>
          </div>

          {/* Cost groups */}
          <div style={{ padding: '12px 26px 24px' }}>
            {COST_GROUPS.map((group, gi) => {
              const groupTotal = group.items.reduce((s, i) => s + (parseFloat(costs[i.id]) || 0), 0)
              const isOpen = openGroups[group.label] ?? false
              return (
                <div key={group.label} style={{
                  borderBottom: gi < COST_GROUPS.length - 1 ? '1px solid var(--border)' : 'none',
                  marginBottom: gi < COST_GROUPS.length - 1 ? '4px' : 0,
                }}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 0', color: 'var(--text)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--teal)' }}>{group.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{group.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        ({group.items.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label)' }}>
                        {groupTotal.toLocaleString('de-AT')} €
                      </span>
                      {isOpen
                        ? <ChevronUp size={15} color="var(--muted)" />
                        : <ChevronDown size={15} color="var(--muted)" />
                      }
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{
                      paddingBottom: '14px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                    }}>
                      {group.items.map(item => (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: 'var(--s3)', borderRadius: 'var(--r-sm)',
                          padding: '10px 14px', border: '1px solid var(--border)',
                        }}>
                          <label style={{
                            flex: 1, fontSize: '12px', color: 'var(--label)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.label}
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <input
                              className="input"
                              type="number" step="0.01" min="0"
                              value={costs[item.id]}
                              onChange={e => updateCost(item.id, e.target.value)}
                              style={{ width: '96px', textAlign: 'right', padding: '6px 10px', fontSize: '12px' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--muted)', width: '16px' }}>€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Variable Kosten */}
        <SettingsSection icon={<DollarSign size={16} />} title="Variable Kosten" subtitle="Standortabhängige Kosten außerhalb der Fixkosten">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              className="input" type="number" step="0.01"
              value={varCosts} onChange={e => setVarCosts(e.target.value)}
              style={{ width: '140px' }}
            />
            <span style={{ color: 'var(--label)', fontSize: '13px' }}>€ / Monat</span>
          </div>
        </SettingsSection>

        {/* CSV Reset */}
        <SettingsSection icon={<Database size={16} />} title="CSV Datenbank" subtitle="Datenimport und System-Resets">
          <div style={{
            background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)',
            borderRadius: '12px', padding: '16px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '3px' }}>
                CSV-Daten zurücksetzen
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Alle importierten Umsatzdaten werden gelöscht.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={async () => {
                if (!accountId) return
                await supabase.from('rev_overrides').delete().eq('account_id', accountId)
                router.refresh()
              }}
            >
              <Trash2 size={13} />
              Zurücksetzen
            </button>
          </div>
        </SettingsSection>

        {/* Save button */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '20px 24px',
          background: 'var(--s2)', border: '1px solid var(--border-card)',
          borderRadius: 'var(--r-lg)',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>Änderungen speichern</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Alle Berechnungen werden sofort aktualisiert.</div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ minWidth: '180px', justifyContent: 'center', gap: '7px' }}
          >
            <Save size={14} />
            {saved ? '✓ Gespeichert!' : loading ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SettingsSection({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{
        padding: '20px 26px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '14px',
        background: 'linear-gradient(135deg, rgba(56,189,248,0.025) 0%, transparent 50%)',
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px',
          background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--teal)', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ padding: '24px 26px' }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        fontSize: '10px', color: 'var(--muted)', fontWeight: 700,
        display: 'block', marginBottom: '8px', letterSpacing: '.7px',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}
