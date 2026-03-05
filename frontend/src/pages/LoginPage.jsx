import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiMail, FiLock, FiUser, FiPhone, FiLogIn, FiUserPlus } from 'react-icons/fi'
import { MdRestaurantMenu, MdVolunteerActivism, MdStorefront } from 'react-icons/md'
import { RiAdminLine } from 'react-icons/ri'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { key: 'restaurant', label: 'Restaurant', icon: MdRestaurantMenu, color: '#22c55e' },
  { key: 'ngo', label: 'NGO', icon: MdVolunteerActivism, color: '#c084fc' },
  { key: 'admin', label: 'Admin', icon: RiAdminLine, color: '#f59e0b' },
  { key: 'provider', label: 'Other Provider', icon: MdStorefront, color: '#10b981' },
]

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [role, setRole] = useState('restaurant')
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let user
      if (mode === 'login') {
        user = await login(form.email, form.password)
      } else {
        user = await register(form.email, form.password, form.name, role, form.phone || undefined)
      }
      // Redirect based on role
      if (user.role === 'ngo') navigate('/ngo')
      else navigate('/')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.5rem', paddingBottom: '2rem',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.08) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'Space Grotesk' }}>
            🥘 <span className="gradient-text">RescueIQ</span>
          </div>
          <p style={{ color: '#64748b', marginTop: 8, fontSize: '0.95rem' }}>
            AI-powered food surplus redistribution
          </p>
        </div>

        <div className="glass" style={{ padding: '2rem', borderRadius: 20 }}>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, marginBottom: '1.5rem' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: mode === m ? 'rgba(34,197,94,0.2)' : 'transparent',
                color: mode === m ? '#4ade80' : '#64748b',
                fontWeight: 600, fontSize: '0.9rem', textTransform: 'capitalize',
                transition: 'all 0.2s',
              }}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Role selector (register only) */}
          {mode === 'register' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>I am a…</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {ROLES.map(({ key, label, icon: Icon, color }) => (
                  <button key={key} onClick={() => setRole(key)} style={{
                    flex: 1, padding: '0.6rem 0.4rem', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${role === key ? color : 'rgba(255,255,255,0.08)'}`,
                    background: role === key ? `${color}18` : 'transparent',
                    color: role === key ? color : '#64748b',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s',
                  }}>
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Name (register only) */}
            {mode === 'register' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Full Name / Org Name</span>
                <div style={{ position: 'relative' }}>
                  <FiUser size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input className="input-field" style={{ paddingLeft: '2.5rem' }}
                    type="text" placeholder="e.g. Spice Garden Restaurant"
                    value={form.name} onChange={set('name')} required />
                </div>
              </label>
            )}

            {/* Email */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Email</span>
              <div style={{ position: 'relative' }}>
                <FiMail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input className="input-field" style={{ paddingLeft: '2.5rem' }}
                  type="email" placeholder="you@example.com"
                  value={form.email} onChange={set('email')} required />
              </div>
            </label>

            {/* Password */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Password</span>
              <div style={{ position: 'relative' }}>
                <FiLock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input className="input-field" style={{ paddingLeft: '2.5rem' }}
                  type="password" placeholder="Min 4 characters"
                  value={form.password} onChange={set('password')} required minLength={4} />
              </div>
            </label>

            {/* Phone (register only) */}
            {mode === 'register' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Phone (optional)</span>
                <div style={{ position: 'relative' }}>
                  <FiPhone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input className="input-field" style={{ paddingLeft: '2.5rem' }}
                    type="tel" placeholder="+91 98765 43210"
                    value={form.phone} onChange={set('phone')} />
                </div>
              </label>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '0.6rem 1rem', color: '#f87171', fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {loading ? '…' : mode === 'login'
                ? <><FiLogIn size={16} /> Sign In</>
                : <><FiUserPlus size={16} /> Create Account</>
              }
            </button>
          </form>

          {/* Demo hint */}
          <div style={{
            marginTop: '1.5rem', padding: '0.75rem 1rem', borderRadius: 10,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>Demo Credentials</div>
            Try any email — create a new account to get started.<br/>
            Food donor login (Restaurant/Other Provider) → Dashboard, NGO login → NGO Queue.
          </div>
        </div>
      </div>
    </div>
  )
}
