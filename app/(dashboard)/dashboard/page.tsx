import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  const accountId = profile.account_id
  const fullName  = profile.full_name ?? user.email ?? ''

  const [machinesRes, costsRes, weRes, overridesRes, snapshotsRes, settingsRes, locationsRes, stockRes, catalogRes] = await Promise.all([
    supabase.from('machines').select('*').eq('account_id', accountId).order('sort_order'),
    supabase.from('machine_costs').select('*'),
    supabase.from('we_overrides').select('*'),
    supabase.from('rev_overrides').select('*').eq('account_id', accountId),
    supabase.from('snapshots').select('*').eq('account_id', accountId),
    supabase.from('fleet_settings').select('*').eq('account_id', accountId).single(),
    supabase.from('locations').select('*').eq('account_id', accountId),
    supabase.from('stock_levels').select('product_id, current_qty, mindestbestand, letzte_bewegung').eq('account_id', accountId),
    supabase.from('catalog_products').select('id, ek_preis: ek').eq('account_id', accountId),
  ])

  const rawMachines = machinesRes.data ?? []
  const costs       = costsRes.data ?? []
  const weOvrs      = weRes.data ?? []
  const revOvrs     = overridesRes.data ?? []
  const locations   = locationsRes.data ?? []

  const machines: Machine[] = rawMachines.map(m => ({
    ...m,
    // standort: prefer location name (post-migration), fall back to text field (pre-migration)
    standort:         locations.find(l => l.id === m.location_id)?.name ?? m.standort ?? '',
    fix_cost:         costs.find(c => c.machine_id === m.id)?.fix_cost,
    we_rate_override: weOvrs.find(w => w.machine_id === m.id)?.we_rate,
    rev_override:     revOvrs.find(r => r.machine_id === m.id)?.rev,
    tx_override:      revOvrs.find(r => r.machine_id === m.id)?.tx,
  }))

  const snapshots: Snapshot[] = snapshotsRes.data ?? []

  // Lager KPIs
  const stockItems = stockRes.data ?? []
  const catalogMap = new Map((catalogRes.data ?? []).map((p: { id: string; ek_preis: number }) => [p.id, p.ek_preis]))
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const lagerKPIs = stockItems.length > 0 ? {
    lagerwert: stockItems.reduce((sum, s) => sum + s.current_qty * (catalogMap.get(s.product_id) ?? 0), 0),
    totesKapital: stockItems
      .filter(s => s.letzte_bewegung && s.letzte_bewegung < thirtyDaysAgo)
      .reduce((sum, s) => sum + s.current_qty * (catalogMap.get(s.product_id) ?? 0), 0),
    baldLeer: stockItems.filter(s => s.mindestbestand != null && s.current_qty <= s.mindestbestand).length,
  } : null

  const settings: FleetSettings = settingsRes.data
    ? { we_rate: settingsRes.data.we_rate, total_fix: settingsRes.data.total_fix, variable_costs: settingsRes.data.variable_costs, revenue_items: settingsRes.data.revenue_items ?? [] }
    : { we_rate: 0.27, total_fix: 0, variable_costs: 0, revenue_items: [] }

  return (
    <DashboardClient
      machines={machines}
      snapshots={snapshots}
      settings={settings}
      accountId={accountId}
      fullName={fullName}
      lagerKPIs={lagerKPIs}
    />
  )
}
