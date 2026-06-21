import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { CatalogProduct, Supplier, StockLevel } from '@/lib/types'
import LagerClient from './LagerClient'

export default async function LagerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('account_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const accountId = profile.account_id

  const [productsRes, suppliersRes, stockRes] = await Promise.all([
    supabase.from('catalog_products').select('*').eq('account_id', accountId).eq('aktiv', true).order('sort_order').order('name'),
    supabase.from('suppliers').select('*').eq('account_id', accountId).order('name'),
    supabase.from('stock_levels').select('*').eq('account_id', accountId),
  ])

  const suppliers: Supplier[] = suppliersRes.data ?? []
  const stockLevels: StockLevel[] = stockRes.data ?? []

  const products: (CatalogProduct & { stock: StockLevel | null; supplier?: Supplier })[] =
    (productsRes.data ?? []).map(p => ({
      ...p,
      supplier: suppliers.find(s => s.id === p.supplier_id),
      stock: stockLevels.find(sl => sl.product_id === p.id) ?? null,
    }))

  return <LagerClient products={products} suppliers={suppliers} accountId={accountId} />
}
