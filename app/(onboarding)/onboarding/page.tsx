import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id, full_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.onboarding_completed) redirect('/dashboard')

  return (
    <OnboardingClient
      accountId={profile.account_id}
      fullName={profile.full_name ?? user.email ?? ''}
      userId={user.id}
    />
  )
}
