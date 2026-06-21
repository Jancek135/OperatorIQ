import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Machine, FleetSettings, Location } from '@/lib/types'
import { getMRev, getMTx, getFleetRev, status } from '@/lib/calculations'
import LocationsClient from './LocationsClient'

export default async function LocationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('account_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const accountId = profile.account_id

  const [machinesRes, costsRes, weRes, overridesRes, settingsRes, locationsRes] = await Promise.all([
    supabase.from('machines').select('*').eq('account_id', accountId).order('sort_order'),
    supabase.from('machine_costs').select('*'),
    supabase.from('we_overrides').select('*'),
    supabase.from('rev_overrides').select('*').eq('account_id', accountId),
    supabase.from('fleet_settings').select('*').eq('account_id', accountId).single(),
    supabase.from('locations').select('*').eq('account_id', accountId),
  ])

  const rawMachines = machinesRes.data ?? []
  const costs       = costsRes.data ?? []
  const weOvrs      = weRes.data ?? []
  const revOvrs     = overridesRes.data ?? []
  const locations: Location[] = locationsRes.data ?? []

  const machines: Machine[] = rawMachines.map(m => ({
    ...m,
    standort:         locations.find(l => l.id === m.location_id)?.name ?? m.standort ?? '',
    fix_cost:         costs.find(c => c.machine_id === m.id)?.fix_cost,
    we_rate_override: weOvrs.find(w => w.machine_id === m.id)?.we_rate,
    rev_override:     revOvrs.find(r => r.machine_id === m.id)?.rev,
    tx_override:      revOvrs.find(r => r.machine_id === m.id)?.tx,
  }))

  const settings: FleetSettings = settingsRes.data
    ? { we_rate: settingsRes.data.we_rate, total_fix: settingsRes.data.total_fix, variable_costs: settingsRes.data.variable_costs }
    : { we_rate: 0.27, total_fix: 0, variable_costs: 0 }

  const fleetRev = getFleetRev(machines)

  const locationSummaries = locations.map(loc => {
    const ms         = machines.filter(m => m.location_id === loc.id)
    const totalRev   = ms.reduce((s, m) => s + getMRev(m), 0)
    const totalTx    = ms.reduce((s, m) => s + getMTx(m), 0)
    const green      = ms.filter(m => status(m, machines, settings) === 'g').length
    const yellow     = ms.filter(m => status(m, machines, settings) === 'y').length
    const red        = ms.filter(m => status(m, machines, settings) === 'r').length
    const share      = fleetRev > 0 ? (totalRev / fleetRev) * 100 : 0
    return { loc, ms, totalRev, totalTx, green, yellow, red, share }
  }).sort((a, b) => b.totalRev - a.totalRev)

  return (
    <LocationsClient
      locationSummaries={locationSummaries}
      fleetRev={fleetRev}
      machineCount={machines.length}
    />
  )
}
