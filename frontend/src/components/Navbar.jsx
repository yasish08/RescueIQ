import { Link, useLocation } from 'react-router-dom'
import { FiHome, FiMap, FiBarChart2, FiHeart, FiSend, FiUser, FiLogOut } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const ROLE_COLOR = { restaurant: '#22c55e', provider: '#10b981', ngo: '#c084fc', admin: '#f59e0b' }

export default function Navbar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const isDonor = user?.role === 'restaurant' || user?.role === 'provider'
  const navItems = user?.role === 'ngo'
    ? [
        { path: '/', icon: FiHome, label: 'Home' },
        { path: '/request', icon: FiSend, label: 'Request' },
        { path: '/ngo', icon: FiHeart, label: 'Accept' },
        { path: '/map', icon: FiMap, label: 'Map' },
        { path: '/impact', icon: FiBarChart2, label: 'Impact' },
      ]
    : isDonor ? [
        { path: '/', icon: FiHome, label: 'Home' },
        { path: '/predict', icon: FiSend, label: 'Donate' },
        { path: '/impact', icon: FiBarChart2, label: 'Insights' },
        { path: '/map', icon: FiMap, label: 'Map' },
        { path: '/profile', icon: FiUser, label: 'Profile' },
      ] : [
        { path: '/', icon: FiHome, label: 'Home' },
        { path: '/impact', icon: FiBarChart2, label: 'Impact' },
        { path: '/map', icon: FiMap, label: 'Map' },
        { path: '/profile', icon: FiUser, label: 'Profile' },
      ]

  return (
    <>
      {/* Top bar — user info + notification bell */}
      {user && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.5rem 1.25rem',
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        }}>
          {/* Brand */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.1rem' }}>🥘</span>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '1rem', color: '#22c55e' }}>
              RescueIQ
            </span>
          </Link>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell />

            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.3rem 0.75rem', borderRadius: 999,
                background: pathname === '/profile' ? `${ROLE_COLOR[user.role]}18` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${pathname === '/profile' ? ROLE_COLOR[user.role] + '44' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
                <FiUser size={14} color={ROLE_COLOR[user.role]} />
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: ROLE_COLOR[user.role],
                  maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.name}
                </span>
              </div>
            </Link>

            <button onClick={logout} title="Logout" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: '50%', color: '#475569',
              transition: 'color 0.2s, background 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'none' }}
            >
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10001,
        background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0.5rem 0', paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = pathname === path
          return (
            <Link
              key={path}
              to={path}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                textDecoration: 'none',
                color: active ? '#22c55e' : '#475569',
                fontSize: '0.65rem', fontWeight: 600,
                transition: 'color 0.2s ease',
                padding: '0.25rem 1rem',
                borderRadius: 10,
                background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
              }}
            >
              <Icon size={22} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
