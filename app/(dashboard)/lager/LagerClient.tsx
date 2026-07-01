'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CatalogProduct, Supplier, StockLevel } from '@/lib/types'
import {
  Package, AlertTriangle, TrendingUp, ShoppingCart,
  Filter, ChevronUp, ChevronDown, X, Plus, Pencil,
  Boxes, Trash2, Check, Clock, Brain, RefreshCw, PackagePlus, FileDown,
} from 'lucide-react'

type ProductWithStock = CatalogProduct & { stock: StockLevel | null; supplier?: Supplier }

interface Props {
  products: ProductWithStock[]
  suppliers: Supplier[]
  accountId: string
}

// ── Helpers ───────────────────────────────────────────────────────

type StockStatus = 'ok' | 'low' | 'order' | 'unknown'

function getStatus(p: ProductWithStock): StockStatus {
  if (!p.stock) return 'unknown'
  const { current_qty, target_qty } = p.stock
  if (target_qty === 0) return 'unknown'
  const ratio = current_qty / target_qty
  if (ratio <= 0.35) return 'order'
  if (ratio < 1)     return 'low'
  return 'ok'
}

function daysUntilEmpty(p: ProductWithStock): number | null {
  if (!p.stock || p.stock.avg_monthly_consumption === 0) return null
  const perDay = p.stock.avg_monthly_consumption / 30
  return Math.round(p.stock.current_qty / perDay)
}

function suggestedOrderQty(p: ProductWithStock): number {
  const consumption = p.stock?.avg_monthly_consumption ?? 0
  const current     = p.stock?.current_qty ?? 0
  const target      = p.stock?.target_qty ?? p.mindestbestand ?? 0
  return Math.max(0, consumption * 2 + target - current)
}

function fmtEur(n: number) {
  return `€ ${n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; bg: string; border: string }> = {
  ok:      { label: '✅ OK',            color: 'var(--green)',  bg: 'rgba(52,211,153,0.09)',  border: 'rgba(52,211,153,0.20)' },
  low:     { label: '🟡 Niedrig',       color: 'var(--yellow)', bg: 'rgba(251,191,36,0.09)',  border: 'rgba(251,191,36,0.20)' },
  order:   { label: '🔴 Nachbestellen', color: 'var(--red)',    bg: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.22)' },
  unknown: { label: '— kein Bestand',   color: 'var(--muted)',  bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)' },
}

type SortKey = 'name' | 'bestand' | 'tage' | 'marge' | 'status'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM = {
  name: '', kategorie: '', emoji: '', ek: '', vk: '',
  mwst_satz: '0.20', mindestbestand: '0', einheit: 'Stk',
  supplier_id: '', barcode: '', avg_monthly_consumption: '0',
}

// ── KPI Card ──────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode
}) {
  return (
    <div className="card kpi-hover" style={{ padding: '20px 18px', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '90px', height: '90px', background: `radial-gradient(circle at 80px 0, ${color}12 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.8px' }}>{label.toUpperCase()}</div>
        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '26px', fontWeight: 900, color, letterSpacing: '-1px', lineHeight: 1, marginBottom: '6px' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub}</div>
    </div>
  )
}

function SortBtn({ col, current, dir, onSort }: { col: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const active = current === col
  return (
    <button onClick={() => onSort(col)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: active ? 'var(--teal)' : 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
      {active ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} style={{ opacity: 0.3 }} />}
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export default function LagerClient({ products: initialProducts, suppliers, accountId }: Props) {
  const router = useRouter()
  const [products, setProducts]     = useState(initialProducts)
  const [filterKat, setFilterKat]   = useState('Alle')
  const [filterSt, setFilterSt]     = useState<StockStatus | 'Alle'>('Alle')
  const [sortKey, setSortKey]       = useState<SortKey>('status')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [editingQty, setEditingQty] = useState<string | null>(null)  // product id
  const [qtyDraft, setQtyDraft]     = useState<Record<string, string>>({})
  const [orderMode, setOrderMode]   = useState(false)
  const [orderQty, setOrderQty]     = useState<Record<string, number>>(() =>
    Object.fromEntries(initialProducts.map(p => [p.id, suggestedOrderQty(p)]))
  )
  const [wareneingangFor, setWareneingangFor] = useState<string | null>(null)
  const [wareneingangQty, setWareneingangQty] = useState('')
  const [wareneingangBusy, setWareneingangBusy] = useState(false)

  const kategorien = ['Alle', ...Array.from(new Set(products.map(p => p.kategorie).filter(Boolean) as string[]))]

  // ── KPI calculations ──
  const withStock    = products.filter(p => p.stock)
  const toOrder      = products.filter(p => getStatus(p) === 'order')
  const lowStock     = products.filter(p => getStatus(p) === 'low')
  const lagerwert    = withStock.reduce((s, p) => s + p.ek * (p.stock?.current_qty ?? 0), 0)

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const toteKapitalProdukte = products.filter(p => {
    if (!p.stock || (p.stock.current_qty ?? 0) <= 0) return false
    if (!p.stock.letzte_bewegung) return true
    return new Date(p.stock.letzte_bewegung).getTime() < Date.now() - THIRTY_DAYS_MS
  })
  const toteKapitalWert = toteKapitalProdukte.reduce((s, p) => s + p.ek * (p.stock?.current_qty ?? 0), 0)

  // ── Filter + Sort ──
  const filtered = products
    .filter(p => filterKat === 'Alle' || p.kategorie === filterKat)
    .filter(p => filterSt === 'Alle' || getStatus(p) === filterSt)
    .sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'name')    { va = a.name; vb = b.name }
      else if (sortKey === 'bestand') { va = a.stock?.current_qty ?? -1; vb = b.stock?.current_qty ?? -1 }
      else if (sortKey === 'tage')    { va = daysUntilEmpty(a) ?? 999; vb = daysUntilEmpty(b) ?? 999 }
      else if (sortKey === 'marge')   { va = (a.vk - a.ek) / (a.vk || 1); vb = (b.vk - b.ek) / (b.vk || 1) }
      else { // status
        const o: Record<StockStatus, number> = { order: 0, low: 1, unknown: 2, ok: 3 }
        va = o[getStatus(a)]; vb = o[getStatus(b)]
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Inline Bestand Edit ──
  async function saveQty(productId: string) {
    const val = parseInt(qtyDraft[productId] ?? '0') || 0
    const supabase = createClient()
    const { data } = await supabase
      .from('stock_levels')
      .upsert({
        account_id:  accountId,
        product_id:  productId,
        current_qty: val,
        target_qty:  products.find(p => p.id === productId)?.mindestbestand ?? 0,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'account_id,product_id' })
      .select()
      .single()

    if (data) {
      setProducts(ps => ps.map(p => p.id === productId ? { ...p, stock: data as StockLevel } : p))
    }
    setEditingQty(null)
  }

  // ── Product CRUD ──
  function openNew() { setForm(EMPTY_FORM); setEditId(null); setShowForm(true) }
  function openEdit(p: ProductWithStock) {
    setForm({
      name: p.name, kategorie: p.kategorie ?? '', emoji: p.emoji ?? '',
      ek: String(p.ek), vk: String(p.vk), mwst_satz: String(p.mwst_satz),
      mindestbestand: String(p.mindestbestand), einheit: p.einheit,
      supplier_id: p.supplier_id ?? '', barcode: p.barcode ?? '',
      avg_monthly_consumption: String(p.stock?.avg_monthly_consumption ?? 0),
    })
    setEditId(p.id); setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.ek || !form.vk) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      account_id: accountId, name: form.name.trim(),
      kategorie: form.kategorie || null, emoji: form.emoji || null,
      ek: parseFloat(form.ek) || 0, vk: parseFloat(form.vk) || 0,
      mwst_satz: parseFloat(form.mwst_satz) || 0.20,
      mindestbestand: parseInt(form.mindestbestand) || 0,
      einheit: form.einheit || 'Stk',
      supplier_id: form.supplier_id || null, barcode: form.barcode || null,
    }
    const avgConsumption = parseInt(form.avg_monthly_consumption) || 0
    let productId = editId

    if (editId) {
      const { data } = await supabase.from('catalog_products').update(payload).eq('id', editId).select().single()
      if (data) setProducts(ps => ps.map(p => p.id === editId ? { ...p, ...data, supplier: suppliers.find(s => s.id === data.supplier_id) } : p))
    } else {
      const { data } = await supabase.from('catalog_products').insert(payload).select().single()
      if (data) {
        productId = data.id
        setProducts(ps => [...ps, { ...data, stock: null, supplier: suppliers.find(s => s.id === data.supplier_id) }])
      }
    }

    if (productId) {
      const { data: stockData } = await supabase
        .from('stock_levels')
        .upsert({
          account_id: accountId,
          product_id: productId,
          avg_monthly_consumption: avgConsumption,
        }, { onConflict: 'account_id,product_id' })
        .select()
        .single()
      if (stockData) {
        setProducts(ps => ps.map(p => p.id === productId ? { ...p, stock: stockData as StockLevel } : p))
      }
    }

    setSaving(false); setShowForm(false); setEditId(null)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('catalog_products').update({ aktiv: false }).eq('id', id)
    setProducts(ps => ps.filter(p => p.id !== id))
    setDeleting(null)
  }

  // ── Wareneingang buchen ──
  async function bookWareneingang(productId: string) {
    const menge = parseInt(wareneingangQty) || 0
    if (menge <= 0) return
    setWareneingangBusy(true)
    const product = products.find(p => p.id === productId)
    const newQty = (product?.stock?.current_qty ?? 0) + menge
    const supabase = createClient()
    const { data } = await supabase
      .from('stock_levels')
      .upsert({
        account_id:      accountId,
        product_id:      productId,
        current_qty:     newQty,
        target_qty:      product?.stock?.target_qty ?? product?.mindestbestand ?? 0,
        letzte_bewegung: new Date().toISOString(),
      }, { onConflict: 'account_id,product_id' })
      .select()
      .single()

    if (data) {
      setProducts(ps => ps.map(p => p.id === productId ? { ...p, stock: data as StockLevel } : p))
    }
    setWareneingangBusy(false)
    setWareneingangFor(null)
    setWareneingangQty('')
  }

  const inp = (field: keyof typeof form, placeholder: string, type = 'text') => (
    <input type={type} value={form[field]} placeholder={placeholder}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '8px 12px', outline: 'none' }}
    />
  )

  const orderTotal = toOrder.reduce((s, p) => s + (orderQty[p.id] ?? 0) * p.ek, 0)

  // ── Bestellung als PDF (Browser-Print, keine externe Dependency) ──
  function exportOrderAsPdf() {
    const today = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' })
    const grouped = new Map<string, typeof toOrder>()
    for (const p of toOrder) {
      const key = p.supplier?.name ?? 'Kein Lieferant'
      grouped.set(key, [...(grouped.get(key) ?? []), p])
    }

    let grandTotal = 0
    let tablesHtml = ''
    for (const [supplierName, items] of grouped.entries()) {
      let subtotal = 0
      const rows = items.map(p => {
        const menge = orderQty[p.id] ?? 0
        const gesamt = menge * p.ek
        subtotal += gesamt
        return `<tr>
          <td>${p.emoji ?? ''} ${p.name}</td>
          <td style="text-align:center">${menge} ${p.einheit}</td>
          <td style="text-align:right">€ ${p.ek.toFixed(2)}</td>
          <td style="text-align:right;font-weight:700">€ ${gesamt.toFixed(2)}</td>
        </tr>`
      }).join('')
      grandTotal += subtotal
      tablesHtml += `
        <div style="margin-bottom:20px;page-break-inside:avoid">
          <div style="background:#0d1b3e;color:#fff;padding:7px 12px;font-size:11px;border-radius:4px 4px 0 0"><strong>${supplierName}</strong></div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#e8edf5">
              <th style="padding:8px 10px;font-size:10px;text-align:left">Produkt</th>
              <th style="padding:8px 10px;font-size:10px;text-align:center">Menge</th>
              <th style="padding:8px 10px;font-size:10px;text-align:right">EK/Stk</th>
              <th style="padding:8px 10px;font-size:10px;text-align:right">Gesamt</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr>
              <td colspan="3" style="text-align:right;padding:8px 10px;font-size:11px;color:#666">Subtotal ${supplierName}</td>
              <td style="text-align:right;padding:8px 10px;font-size:11px;font-weight:800">€ ${subtotal.toFixed(2)}</td>
            </tr></tfoot>
          </table>
        </div>`
    }

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Bestellung – ${today}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, Arial, sans-serif; font-size:12px; color:#1a1a2e; padding:20mm; }
        td { padding:8px 10px; border-bottom:1px solid #e8e8f0; }
        .total-box { margin-top:20px; background:#0d1b3e; color:#fff; padding:14px 18px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; }
        .total-value { font-size:22px; font-weight:900; color:#4fc3f7; }
        @media print { body { padding:10mm 15mm; } @page { margin:10mm; } }
      </style></head>
      <body>
        <h1 style="font-size:20px;margin-bottom:4px">Bestellung — ${today}</h1>
        ${tablesHtml}
        <div class="total-box">
          <span>Gesamtbetrag</span>
          <span class="total-value">€ ${grandTotal.toFixed(2)}</span>
        </div>
        <div style="margin-top:20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px">
          Erstellt mit VendoAI
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body></html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) { alert('Popup blockiert — bitte Popups für diese Seite erlauben.'); return }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: '1300px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)' }}>
              <Boxes size={17} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-1px' }}>Produktkatalog & Lager</h1>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', paddingLeft: '46px' }}>
            {products.length} Produkte · {withStock.length} mit Bestandsdaten · Echtdaten aus Supabase
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {toOrder.length > 0 && (
            <button onClick={() => setOrderMode(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, border: 'none',
              background: orderMode ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.10)',
              color: 'var(--red)', transition: 'all .15s',
            }}>
              <ShoppingCart size={15} /> {orderMode ? 'Schließen' : `Nachbestellen (${toOrder.length})`}
            </button>
          )}
          <button onClick={openNew} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
            borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
            border: 'none', background: 'var(--teal)', color: '#0a1628',
          }}>
            <Plus size={15} /> Produkt hinzufügen
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <KpiCard label="Produkte" value={String(products.length)} sub={`${withStock.length} mit Bestand erfasst`} color="var(--teal)" icon={<Package size={14} />} />
        <KpiCard label="Lagerwert (EK)" value={fmtEur(lagerwert)} sub="aktueller Lagerbestand × EK" color="var(--label)" icon={<Boxes size={14} />} />
        <KpiCard label="Nachbestellen" value={String(toOrder.length)} sub={`${lowStock.length} weitere niedrig`} color={toOrder.length > 0 ? 'var(--red)' : 'var(--green)'} icon={<AlertTriangle size={14} />} />
        <KpiCard
          label="Totes Kapital"
          value={fmtEur(toteKapitalWert)}
          sub={`${toteKapitalProdukte.length} Produkte ohne Bewegung >30 Tage`}
          color={toteKapitalWert > 0 ? 'var(--red)' : 'var(--green)'}
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* ── KI Nachbestellung Panel ── */}
      {orderMode && toOrder.length > 0 && (
        <div style={{
          background: 'var(--s2)', border: '1px solid rgba(248,113,113,0.22)',
          borderRadius: 'var(--r-lg)', marginBottom: '24px', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(248,113,113,0.04)' }}>
            <Brain size={16} color="var(--red)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--red)' }}>KI-Nachbestellvorschlag</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Basierend auf aktuellem Bestand und Verbrauch — Mengen anpassbar</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '16px', fontWeight: 900, color: 'var(--teal)' }}>{fmtEur(orderTotal)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', padding: '14px 18px' }}>
            {toOrder.map(p => {
              const days = daysUntilEmpty(p)
              return (
                <div key={p.id} style={{ background: 'var(--s3)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{p.emoji || '📦'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: days !== null && days < 3 ? 'var(--red)' : 'var(--muted)' }}>
                        {days !== null ? `noch ca. ${days} Tage` : `Bestand: ${p.stock?.current_qty ?? 0}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => setOrderQty(q => ({ ...q, [p.id]: Math.max(0, (q[p.id] ?? 0) - 10) }))}
                      style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--s4)', border: '1px solid var(--border)', color: 'var(--label)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>−</button>
                    <input type="number" value={orderQty[p.id] ?? 0}
                      onChange={e => setOrderQty(q => ({ ...q, [p.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      style={{ flex: 1, textAlign: 'center', background: 'var(--s4)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '13px', fontWeight: 700, padding: '4px 6px', outline: 'none' }}
                    />
                    <button onClick={() => setOrderQty(q => ({ ...q, [p.id]: (q[p.id] ?? 0) + 10 }))}
                      style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--s4)', border: '1px solid var(--border)', color: 'var(--teal)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>+</button>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{fmtEur((orderQty[p.id] ?? 0) * p.ek)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--s1)' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Bestellwert gesamt</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button onClick={exportOrderAsPdf} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
                background: 'var(--s3)', color: 'var(--label)', fontSize: '12px', fontWeight: 700,
              }}>
                <FileDown size={13} /> Bestellung als PDF
              </button>
              <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--teal)' }}>{fmtEur(orderTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.5px', color: 'var(--muted)' }}>KATEGORIE:</span>
        {kategorien.map(k => (
          <button key={k} onClick={() => setFilterKat(k)} style={{
            padding: '4px 11px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
            background: filterKat === k ? 'rgba(56,189,248,0.12)' : 'transparent',
            borderColor: filterKat === k ? 'rgba(56,189,248,0.35)' : 'var(--border)',
            color: filterKat === k ? 'var(--teal)' : 'var(--muted)', transition: 'all .15s',
          }}>{k}</button>
        ))}
        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
        {(['order', 'low', 'ok', 'unknown'] as StockStatus[]).map(st => (
          <button key={st} onClick={() => setFilterSt(filterSt === st ? 'Alle' : st)} style={{
            padding: '4px 11px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
            background: filterSt === st ? `${STATUS_CONFIG[st].color}14` : 'transparent',
            borderColor: filterSt === st ? `${STATUS_CONFIG[st].color}44` : 'var(--border)',
            color: filterSt === st ? STATUS_CONFIG[st].color : 'var(--muted)', transition: 'all .15s',
          }}>{STATUS_CONFIG[st].label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{filtered.length} Produkte</span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 130px 110px 80px 100px 110px 108px', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--s1)' }}>
          {[
            { label: '',          key: null },
            { label: 'Produkt',   key: 'name' as SortKey },
            { label: 'Bestand',   key: 'bestand' as SortKey },
            { label: 'EK / VK',   key: null },
            { label: 'Marge',     key: 'marge' as SortKey },
            { label: 'Status',    key: 'status' as SortKey },
            { label: 'KI-Prog.',  key: 'tage' as SortKey },
            { label: '',          key: null },
          ].map(({ label, key }, i) => (
            <div key={i} style={{ padding: '12px 0', fontSize: '10px', fontWeight: 700, letterSpacing: '.7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              {label}{key && <SortBtn col={key} current={sortKey} dir={sortDir} onSort={toggleSort} />}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
            <Package size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Noch keine Produkte</div>
            <div style={{ fontSize: '12px' }}>Klicke "Produkt hinzufügen" um deinen Katalog aufzubauen.</div>
          </div>
        )}

        {/* Rows */}
        {filtered.map((p, i) => {
          const st    = getStatus(p)
          const cfg   = STATUS_CONFIG[st]
          const marge = p.vk > 0 ? ((p.vk - p.ek) / p.vk * 100) : 0
          const days  = daysUntilEmpty(p)
          const isEditingQty = editingQty === p.id
          const qty = p.stock?.current_qty ?? 0
          const targetQty = p.stock?.target_qty ?? p.mindestbestand ?? 0
          const bestandPct = targetQty > 0 ? Math.min(100, (qty / (targetQty * 2)) * 100) : 0

          return (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '44px 1fr 130px 110px 80px 100px 110px 108px',
              padding: '0 16px',
              borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: st === 'order' ? 'rgba(248,113,113,0.02)' : 'transparent',
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.02)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = st === 'order' ? 'rgba(248,113,113,0.02)' : 'transparent'}
            >
              {/* Emoji */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', fontSize: '20px' }}>
                {p.emoji || '📦'}
              </div>

              {/* Name + supplier */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 12px 14px 0' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{p.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                  {[p.kategorie, p.supplier?.name].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>

              {/* Bestand — inline editable */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 0', gap: '5px' }}>
                {isEditingQty ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      autoFocus
                      type="number"
                      value={qtyDraft[p.id] ?? String(qty)}
                      onChange={e => setQtyDraft(d => ({ ...d, [p.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveQty(p.id); if (e.key === 'Escape') setEditingQty(null) }}
                      style={{ width: '52px', background: 'var(--s3)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '6px', color: 'var(--text)', fontSize: '13px', padding: '3px 6px', outline: 'none', textAlign: 'center' }}
                    />
                    <button onClick={() => saveQty(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', padding: '2px', display: 'flex' }}>
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    style={{ display: 'flex', alignItems: 'baseline', gap: '4px', cursor: 'pointer' }}
                    onClick={() => { setEditingQty(p.id); setQtyDraft(d => ({ ...d, [p.id]: String(qty) })) }}
                    title="Klicken um Bestand zu ändern"
                  >
                    <span style={{ fontSize: '14px', fontWeight: 800, color: cfg.color }}>{qty}</span>
                    {targetQty > 0 && <span style={{ fontSize: '10px', color: 'var(--muted)' }}>/ {targetQty}</span>}
                    <RefreshCw size={10} color="var(--muted)" style={{ marginLeft: '2px', opacity: 0.5 }} />
                  </div>
                )}
                {!isEditingQty && targetQty > 0 && (
                  <div style={{ height: '3px', background: 'var(--s3)', borderRadius: '99px', overflow: 'hidden', width: '80px' }}>
                    <div className="progress-fill" style={{ height: '100%', borderRadius: '99px', width: `${bestandPct}%`, background: cfg.color }} />
                  </div>
                )}
              </div>

              {/* EK / VK */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 0' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>EK {fmtEur(p.ek)}</div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>VK {fmtEur(p.vk)}</div>
              </div>

              {/* Marge */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: marge > 55 ? 'var(--green)' : marge > 35 ? 'var(--teal)' : 'var(--yellow)' }}>
                  {marge.toFixed(1)}%
                </span>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.3px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap' }}>
                  {cfg.label}
                </span>
              </div>

              {/* KI-Prognose */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 0' }}>
                {days !== null ? (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: days < 7 ? 'var(--red)' : days < 14 ? 'var(--yellow)' : 'var(--label)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {days}d
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>bis leer</div>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>kein Verbrauch</span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '14px 0' }}>
                <button onClick={() => { setWareneingangFor(p.id); setWareneingangQty('') }} title="Wareneingang buchen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '5px', borderRadius: '6px', display: 'flex', transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--green)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}>
                  <PackagePlus size={14} />
                </button>
                <button onClick={() => openEdit(p)} title="Bearbeiten" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '5px', borderRadius: '6px', display: 'flex', transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--teal)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} title="Löschen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '5px', borderRadius: '6px', display: 'flex', transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--red)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Totes Kapital Sektion ── */}
      {toteKapitalProdukte.length > 0 && (
        <div style={{ marginTop: '20px', background: 'var(--s2)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(248,113,113,0.04)' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--red)' }}>⚠️ Totes Kapital</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Produkte ohne Bewegung seit über 30 Tagen — bindet Kapital ohne Umschlag</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px 120px 1fr', padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
            {['Produkt', 'Menge', 'Tage ohne Bewegung', 'Gebundener Wert', 'KI-Tipp'].map((h, i) => (
              <div key={i} style={{ padding: '10px 0', fontSize: '10px', fontWeight: 700, letterSpacing: '.5px', color: 'var(--muted)' }}>{h}</div>
            ))}
          </div>
          {toteKapitalProdukte.map((p, i) => {
            const menge = p.stock?.current_qty ?? 0
            const days = p.stock?.letzte_bewegung
              ? Math.floor((Date.now() - new Date(p.stock.letzte_bewegung).getTime()) / (24 * 60 * 60 * 1000))
              : null
            const wert = menge * p.ek
            const tipp = menge > 50 ? 'Rabatt empfehlen oder Standortwechsel prüfen' : 'In anderen Automaten testen'
            return (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 90px 140px 120px 1fr', padding: '0 20px',
                borderBottom: i < toteKapitalProdukte.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{ padding: '12px 0', fontSize: '13px', fontWeight: 600 }}>{p.emoji ?? '📦'} {p.name}</div>
                <div style={{ padding: '12px 0', fontSize: '13px', display: 'flex', alignItems: 'center' }}>{menge}</div>
                <div style={{ padding: '12px 0', fontSize: '13px', display: 'flex', alignItems: 'center', color: 'var(--red)' }}>
                  {days !== null ? `${days} Tage` : 'nie erfasst'}
                </div>
                <div style={{ padding: '12px 0', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center' }}>{fmtEur(wert)}</div>
                <div style={{ padding: '12px 0', fontSize: '12px', color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Brain size={12} /> {tipp}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hinweis wenn kein Verbrauch eingetragen */}
      {withStock.length > 0 && products.every(p => !p.stock?.avg_monthly_consumption) && (
        <div style={{ marginTop: '16px', padding: '14px 18px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 'var(--r-sm)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Brain size={16} color="var(--teal)" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: 'var(--label)' }}>
            <strong>KI-Prognose noch nicht aktiv:</strong> Trage den monatlichen Verbrauch pro Produkt ein damit "Tage bis leer" und Nachbestellvorschläge berechnet werden können. Kommt in Sprint 4 als automatische Berechnung aus Transaktionsdaten.
          </div>
        </div>
      )}

      {/* ── Wareneingang Modal ── */}
      {wareneingangFor && (() => {
        const p = products.find(pr => pr.id === wareneingangFor)
        if (!p) return null
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => e.target === e.currentTarget && setWareneingangFor(null)}>
            <div style={{ width: '340px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PackagePlus size={17} color="var(--green)" /> Wareneingang
                </div>
                <button onClick={() => setWareneingangFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}><X size={16} /></button>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{p.emoji ?? '📦'} {p.name}</div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.7px', color: 'var(--muted)', marginBottom: '6px' }}>STÜCK ERHALTEN</div>
                <input
                  autoFocus
                  type="number"
                  min={1}
                  value={wareneingangQty}
                  onChange={e => setWareneingangQty(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') bookWareneingang(p.id) }}
                  placeholder="z.B. 120"
                  style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, padding: '10px 12px', outline: 'none', textAlign: 'center' }}
                />
              </div>
              <button
                onClick={() => bookWareneingang(p.id)}
                disabled={wareneingangBusy || !parseInt(wareneingangQty)}
                style={{ padding: '11px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'var(--green)', color: '#0a1628', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: wareneingangBusy || !parseInt(wareneingangQty) ? 0.6 : 1 }}
              >
                <Check size={16} /> {wareneingangBusy ? 'Buchen…' : 'Buchen'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Add/Edit Form Panel ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ width: '420px', height: '100vh', background: 'var(--s1)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{editId ? 'Produkt bearbeiten' : 'Neues Produkt'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', borderRadius: '6px' }}><X size={18} /></button>
            </div>

            <FormField label="NAME *">{inp('name', 'z.B. Cola Classic 0,5L')}</FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="EMOJI">{inp('emoji', '🥤')}</FormField>
              <FormField label="EINHEIT">{inp('einheit', 'Stk')}</FormField>
            </div>
            <FormField label="KATEGORIE">{inp('kategorie', 'Getränke')}</FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="EK (€) *">{inp('ek', '0.62', 'number')}</FormField>
              <FormField label="VK (€) *">{inp('vk', '1.90', 'number')}</FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="MWST">
                <select value={form.mwst_satz} onChange={e => setForm(f => ({ ...f, mwst_satz: e.target.value }))}
                  style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '8px 12px', outline: 'none' }}>
                  <option value="0.10">10%</option>
                  <option value="0.20">20%</option>
                  <option value="0.00">0%</option>
                </select>
              </FormField>
              <FormField label="MINDESTBESTAND">{inp('mindestbestand', '10', 'number')}</FormField>
            </div>
            <FormField label="Ø VERBRAUCH/MONAT (STK)">{inp('avg_monthly_consumption', '30', 'number')}</FormField>
            <FormField label="LIEFERANT">
              <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '8px 12px', outline: 'none' }}>
                <option value="">— Kein Lieferant —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="BARCODE (EAN)">{inp('barcode', '9001234567890')}</FormField>

            {form.ek && form.vk && parseFloat(form.vk) > 0 && (
              <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, marginBottom: '4px' }}>MARGE VORSCHAU</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--green)' }}>
                  {(((parseFloat(form.vk) - parseFloat(form.ek)) / parseFloat(form.vk)) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>+{fmtEur(parseFloat(form.vk) - parseFloat(form.ek))} pro Stück</div>
              </div>
            )}

            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.ek || !form.vk}
              style={{ padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'var(--teal)', color: '#0a1628', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: saving || !form.name.trim() ? 0.6 : 1, marginTop: 'auto' }}>
              <Check size={16} /> {saving ? 'Speichern…' : editId ? 'Änderungen speichern' : 'Produkt anlegen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.7px', color: 'var(--muted)', marginBottom: '6px' }}>{label}</div>
      {children}
    </div>
  )
}
