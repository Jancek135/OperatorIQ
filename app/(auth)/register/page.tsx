'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [fullName, setFullName]     = useState('')
  const [companyName, setCompany]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name:    fullName,
          company_name: companyName,
        }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ marginBottom: '10px' }}>Registrierung erfolgreich!</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '20px', fontSize: '13px' }}>
            Bitte prüfe deine E-Mails und bestätige dein Konto. Danach kannst du dich anmelden.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>
            Zum Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg)'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--blue), var(--green))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px'
          }}>
            VendoAI
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Kostenlosen Account anlegen
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>
            Konto erstellen
          </h2>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  VORNAME / NAME
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Max Mustermann"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  FIRMENNAME
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Mein Betrieb GmbH"
                  value={companyName}
                  onChange={e => setCompany(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                E-MAIL
              </label>
              <input
                className="input"
                type="email"
                placeholder="du@betrieb.at"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                PASSWORT
              </label>
              <input
                className="input"
                type="password"
                placeholder="Min. 8 Zeichen"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <div style={{ background: 'var(--rdim)', color: 'var(--red)', padding: '10px 14px', borderRadius: '7px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
            >
              {loading ? 'Wird erstellt…' : 'Konto anlegen'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
            Bereits ein Konto?{' '}
            <Link href="/login" style={{ color: 'var(--blue)' }}>
              Anmelden
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
