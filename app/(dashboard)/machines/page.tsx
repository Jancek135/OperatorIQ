import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Machine, Snapshot, FleetSettings } from '@/lib/types'
import MachinesClient from './MachinesClient'

export default async function MachinesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('account_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const accountId = profile.account_id

  const [machinesRes, costsRes, weRes, overridesRes, snapshotsRes, settingsRes, locationsRes] = await Promise.all([
    supabase.from('machines').select('*').eq('account_id', accountId).order('sort_order'),
    supabase.from('machine_costs').select('*'),
    supabase.from('we_overrides').select('*'),
    supabase.from('rev_overrides').select('*').eq('account_id', accountId),
    supabase.from('snapshots').select('*').eq('account_id', accountId),
    supabase.from('fleet_settings').select('*').eq('account_id', accountId).single(),
    supabase.from('locations').select('*').eq('account_id', accountId),
  ])

  const rawMachines = machinesRes.data ?? []
  const costs       = costsRes.data ?? []
  const weOvrs      = weRes.data ?? []
  const revOvrs     = overridesRes.data ?? []
  const locations   = locationsRes.data ?? []

  const machines: Machine[] = rawMachines.map(m => ({
    ...m,
    standort:         locations.find(l => l.id === m.location_id)?.name ?? m.standort ?? '',
    fix_cost:         costs.find(c => c.machine_id === m.id)?.fix_cost,
    we_rate_override: weOvrs.find(w => w.machine_id === m.id)?.we_rate,
    rev_override:     revOvrs.find(r => r.machine_id === m.id)?.rev,
    tx_override:      revOvrs.find(r => r.machine_id === m.id)?.tx,
  }))

  const snapshots: Snapshot[] = snapshotsRes.data ?? []
  const settings: FleetSettings = settingsRes.data
    ? { we_rate: settingsRes.data.we_rate, total_fix: settingsRes.data.total_fix, variable_costs: settingsRes.data.variable_costs }
    : { we_rate: 0.27, total_fix: 0, variable_costs: 0 }

  return (
    <MachinesClient
      machines={machines}
      snapshots={snapshots}
      settings={settings}
      accountId={accountId}
    />
  )
}
