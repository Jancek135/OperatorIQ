'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Location, CatalogProduct, RefillItem } from '@/lib/types'
import { Truck, Plus, Trash2, Check, MapPin } from 'lucide-react'

interface Props {
  locations: Location[]
  products: CatalogProduct[]
  items: RefillItem[]
  accountId: string
}

export default function BefuellplanClient({ locations, products, items, accountId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [selProduct, setSelProduct] = useState('')
  const [selMenge, setSelMenge] = useState(1)
  const [busy, setBusy] = useState(false)

  const itemsByLocation = useMemo(() => {
    const map = new Map<string, RefillItem[]>()
    for (const loc of locations) map.set(loc.id, [])
    for (const item of items) {
      const arr = map.get(item.location_id)
      if (arr) arr.push(item)
    }
    return map
  }, [items, locations])

  const totalOffen = items.filter(i => !i.erledigt).length

  async function addItem(locationId: string) {
    if (!selProduct) return
    setBusy(true)
    await supabase.from('refill_items').insert({
      account_id: accountId,
      location_id: locationId,
      product_id: selProduct,
      menge: selMenge,
    })
    setBusy(false)
    setAddingFor(null)
    setSelProduct('')
    setSelMenge(1)
    router.refresh()
  }

  async function toggleDone(item: RefillItem) {
    await supabase.from('refill_items').update({ erledigt: !item.erledigt }).eq('id', item.id)
    router.refresh()
  }

  async function removeItem(id: string) {
    await supabase.from('refill_items').delete().eq('id', id)
    router.refresh()
  }

  if (locations.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '32px' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <Truck size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <div>Noch keine Standorte angelegt.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-pad" style={{ padding: '40px 44px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={22} color="var(--teal)" /> Befüllplan
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {totalOffen > 0 ? `${totalOffen} offene Position${totalOffen !== 1 ? 'en' : ''}` : 'Alles erledigt'}
          </div>
        </div>
      </div>

      {/* Standort-Karten */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {locations.map(loc => {
          const locItems = itemsByLocation.get(loc.id) ?? []
          const openItems = locItems.filter(i => !i.erledigt)
          const doneItems = locItems.filter(i => i.erledigt)
          const isAdding = addingFor === loc.id

          return (
            <div key={loc.id} className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} color="var(--muted)" />
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{loc.name}</span>
                  {openItems.length > 0 && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color: 'var(--yellow)',
                      background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)',
                      borderRadius: '99px', padding: '1px 8px',
                    }}>
                      {openItems.length} offen
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setAddingFor(isAdding ? null : loc.id)}
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '6px 10px', cursor: 'pointer', color: 'var(--teal)',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600,
                  }}
                >
                  <Plus size={14} /> Produkt
                </button>
              </div>

              {/* Add-Formular */}
              {isAdding && (
                <div style={{
                  display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px',
                  padding: '12px', background: 'var(--s2)', borderRadius: '10px', border: '1px solid var(--border)',
                }}>
                  <select
                    value={selProduct}
                    onChange={e => setSelProduct(e.target.value)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: 'var(--s1)', color: 'var(--text)', fontSize: '13px',
                    }}
                  >
                    <option value="">Produkt wählen...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.emoji ?? ''} {p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={selMenge}
                    onChange={e => setSelMenge(parseInt(e.target.value) || 1)}
                    style={{
                      width: '70px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: 'var(--s1)', color: 'var(--text)', fontSize: '13px',
                    }}
                  />
                  <button
                    onClick={() => addItem(loc.id)}
                    disabled={!selProduct || busy}
                    style={{
                      padding: '8px 14px', borderRadius: '8px', border: 'none',
                      background: selProduct ? 'var(--teal)' : 'var(--border)', color: '#000',
                      cursor: selProduct ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    Hinzufügen
                  </button>
                </div>
              )}

              {locItems.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '8px 0' }}>
                  Keine Produkte geplant.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[...openItems, ...doneItems].map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px', borderRadius: '8px',
                        background: item.erledigt ? 'transparent' : 'var(--s2)',
                        opacity: item.erledigt ? 0.45 : 1,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <button
                        onClick={() => toggleDone(item)}
                        style={{
                          width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                          border: `1.5px solid ${item.erledigt ? 'var(--green)' : 'var(--border)'}`,
                          background: item.erledigt ? 'var(--green)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                      >
                        {item.erledigt && <Check size={13} color="#000" />}
                      </button>
                      <span style={{ fontSize: '13px', flex: 1, textDecoration: item.erledigt ? 'line-through' : 'none' }}>
                        {item.product?.emoji ?? ''} {item.product?.name ?? 'Unbekanntes Produkt'}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                        {item.menge}× {item.product?.einheit ?? 'Stk'}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
