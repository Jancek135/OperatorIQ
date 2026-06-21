'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Cpu, Mail, Lock, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router    = useRouter()
  const supabase  = createClient()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #38bdf8 0%, #1680b0 100%)',
            borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(56,189,248,0.22)',
          }}>
            <Cpu size={26} color="#fff" strokeWidth={2} />
          </div>
          <div style={{
            fontSize: '30px', fontWeight: 900, letterSpacing: '-1px',
            background: 'linear-gradient(135deg, #38bdf8, #93e8ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '6px',
          }}>
            VendoAI
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Fleet Intelligence für Automaten-Betreiber
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--s1)',
          border: '1px solid rgba(56,189,248,0.14)',
          borderRadius: 'var(--r-xl)',
          padding: '32px',
          boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.04)',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>Willkommen zurück</h2>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '28px' }}>
            Melde dich in deinem Account an.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{
                fontSize: '10px', color: 'var(--muted)', fontWeight: 700,
                display: 'block', marginBottom: '7px', letterSpacing: '.7px',
              }}>
                E-MAIL
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', display: 'flex',
                }}>
                  <Mail size={15} />
                </span>
                <input
                  className="input"
                  type="email" placeholder="du@betrieb.at"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <div>
              <label style={{
                fontSize: '10px', color: 'var(--muted)', fontWeight: 700,
                display: 'block', marginBottom: '7px', letterSpacing: '.7px',
              }}>
                PASSWORT
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--muted)', display: 'flex',
                }}>
                  <Lock size={15} />
                </span>
                <input
                  className="input"
                  type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(240,79,79,0.1)', color: 'var(--red)',
                border: '1px solid rgba(240,79,79,0.25)',
                padding: '11px 14px', borderRadius: '10px', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px', padding: '12px', fontSize: '14px' }}
            >
              {loading ? 'Anmelden…' : (
                <>Anmelden <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
            Noch kein Konto?{' '}
            <Link href="/register" style={{ color: 'var(--teal)', fontWeight: 600 }}>
              Registrieren →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
