import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Location, CatalogProduct, RefillItem } from '@/lib/types'
import BefuellplanClient from './BefuellplanClient'

export default async function BefuellplanPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('account_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const accountId = profile.account_id

  const [locationsRes, productsRes, itemsRes] = await Promise.all([
    supabase.from('locations').select('*').eq('account_id', accountId).order('name'),
    supabase.from('catalog_products').select('*').eq('account_id', accountId).eq('aktiv', true).order('name'),
    supabase.from('refill_items').select('*').eq('account_id', accountId).order('created_at'),
  ])

  const locations: Location[] = locationsRes.data ?? []
  const products: CatalogProduct[] = productsRes.data ?? []
  const productMap = new Map(products.map(p => [p.id, p]))

  const items: RefillItem[] = (itemsRes.data ?? []).map(i => ({
    ...i,
    product: productMap.get(i.product_id),
  }))

  return (
    <BefuellplanClient
      locations={locations}
      products={products}
      items={items}
      accountId={accountId}
    />
  )
}
