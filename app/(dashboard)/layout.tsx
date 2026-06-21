import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavClient from '@/components/NavClient'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, account_id, accounts(name)')
    .eq('id', user.id)
    .single()

  const accountName = (profile?.accounts as any)?.name || profile?.full_name?.split(' ')[0] || 'Workspace'
  const fullName    = profile?.full_name ?? user.email ?? ''

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <NavClient accountName={accountName} fullName={fullName} />

      {/* Main Content */}
      <main className="main-content" style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
