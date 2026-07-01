'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Cpu, MapPin, Settings, Bell,
  LogOut, ChevronRight, SlidersHorizontal, Menu, X, Newspaper, Boxes, Truck,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',      Icon: LayoutDashboard },
  { href: '/briefing',     label: 'Daily Briefing', Icon: Newspaper },
  { href: '/machines',     label: 'Maschinen',      Icon: Cpu },
  { href: '/locations',    label: 'Standorte',      Icon: MapPin },
  { href: '/lager',        label: 'Lager',          Icon: Boxes },
  { href: '/befuellplan',  label: 'Befüllplan',     Icon: Truck },
  { href: '/simulator',    label: 'Simulator',      Icon: SlidersHorizontal },
  { href: '/settings',     label: 'Einstellungen',  Icon: Settings },
]

interface NavClientProps {
  accountName: string
  fullName: string
}

export default function NavClient({ accountName, fullName }: NavClientProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile nav when route changes
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Prevent body scroll when nav open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const currentPage = NAV_ITEMS.find(item =>
    item.href === pathname || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  )

  // ── Sidebar content (shared between desktop + mobile) ──
  const SidebarContent = (
    <>
      {/* ── Brand header ── */}
      <div style={{
        padding: '22px 20px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Logo icon */}
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, #38bdf8 0%, #1680b0 100%)',
            borderRadius: 'var(--r-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(56,189,248,0.20)',
            flexShrink: 0,
          }}>
            <Cpu size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{
              fontSize: '15px', fontWeight: 800, letterSpacing: '-.2px',
              background: 'linear-gradient(135deg, #38bdf8, #93e8ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              VendoAI
            </div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '-1px' }}>
              {accountName}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            title="Benachrichtigungen"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: '4px', borderRadius: '6px',
              transition: 'color .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--teal)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <Bell size={17} />
          </button>
          {/* Close button — only visible in mobile slide-in */}
          <button
            className="mobile-close-btn"
            onClick={() => setMobileOpen(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: '4px', borderRadius: '6px',
              display: 'none',
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* ── Nav items ── */}
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link ${active ? 'active' : ''}`}
              style={{ position: 'relative' }}
            >
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '20px',
                  background: 'var(--teal)',
                  borderRadius: '0 3px 3px 0',
                  boxShadow: '0 0 8px rgba(56,189,248,0.4)',
                }} />
              )}
              <Icon
                size={17}
                strokeWidth={active ? 2.5 : 1.8}
                style={{ marginLeft: active ? '6px' : '2px', flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{label}</span>
              {active && <ChevronRight size={13} style={{ opacity: .4 }} />}
            </Link>
          )
        })}
      </nav>

      {/* ── User footer ── */}
      <div style={{ padding: '14px 12px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: 'var(--r-sm)',
          marginBottom: '8px',
          background: 'var(--s2)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(56,189,248,0.10)',
            border: '1.5px solid rgba(56,189,248,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: 'var(--teal)',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '12px', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {fullName || 'Owner'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--teal)', fontWeight: 600 }}>OWNER</div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%', background: 'none', border: '1px solid var(--border)',
            borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 12px', color: 'var(--muted)', fontSize: '13px', fontWeight: 500,
            transition: 'all .18s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--red)'
            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.25)'
            e.currentTarget.style.background = 'rgba(248,113,113,0.06)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--muted)'
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.background = 'none'
          }}
        >
          <LogOut size={15} />
          <span>Abmelden</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text)', padding: '6px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Menu size={22} />
        </button>

        {/* Brand center */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px', height: '26px',
            background: 'linear-gradient(135deg, #38bdf8 0%, #1680b0 100%)',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Cpu size={13} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{
            fontSize: '14px', fontWeight: 800,
            background: 'linear-gradient(135deg, #38bdf8, #93e8ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Standlomat
          </span>
          {currentPage && (
            <>
              <span style={{ color: 'var(--border)', fontSize: '14px' }}>/</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                {currentPage.label}
              </span>
            </>
          )}
        </div>

        {/* Right: initials avatar */}
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'rgba(56,189,248,0.10)',
          border: '1.5px solid rgba(56,189,248,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, color: 'var(--teal)',
        }}>
          {initials}
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      <div
        className={`mobile-nav-backdrop${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar (desktop: static; mobile: fixed slide-in) ── */}
      <aside
        className={`sidebar-desktop${mobileOpen ? ' mobile-open' : ''}`}
        style={{
          width: '228px',
          flexShrink: 0,
          background: 'var(--s1)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
      >
        {SidebarContent}
      </aside>

      {/* Inline styles for mobile-close-btn visibility */}
      <style>{`
        @media (max-width: 640px) {
          .mobile-close-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
