import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiCheck, FiX, FiShield, FiPackage, FiStar, FiEdit2, FiAlertCircle, FiRefreshCw
} from 'react-icons/fi'
import { MdRestaurantMenu } from 'react-icons/md'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import ReviewCard from '../components/ReviewCard'

const STATUS_COLOR = {
  pending: '#94a3b8', matched: '#60a5fa', accepted: '#fbbf24',
  picked_up: '#c084fc', delivered: '#22c55e', cancelled: '#f87171',
}

export default function RestaurantProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [donations, setDonations] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  // GSTIN checker state
  const [gstin, setGstin] = useState('')
  const [gstinResult, setGstinResult] = useState(null)
  const [gstinLoading, setGstinLoading] = useState(false)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
  }, [user]) // eslint-disable-line

  async function fetchAll() {
    setLoading(true)
    try {
      const data = await api.getRestaurantProfile(user.id)
      setProfile(data.restaurant)
      setDonations(data.donations || [])
      setGstin(data.restaurant.gstin || '')
      setForm({
        name: data.restaurant.name,
        address: data.restaurant.address,
        cuisine_type: data.restaurant.cuisine_type || '',
        phone: data.user?.phone || '',
      })
      const r = await api.getReviews(user.id)
      setReviews(r)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function verifyGSTIN() {
    if (!gstin) return
    setGstinLoading(true)
    try {
      const res = await api.verifyGSTIN(gstin)
      setGstinResult(res)
      if (res.verified) {
        await api.updateRestaurantProfile(user.id, { gstin })
        setProfile(p => ({ ...p, gstin }))
      }
    } catch { setGstinResult({ verified: false, message: '❌ Verification failed' }) }
    setGstinLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await api.updateRestaurantProfile(user.id, form)
      setProfile(p => ({ ...p, ...form }))
      setEditing(false)
    } catch { /* silently keep editing */ }
    setSaving(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '6rem', color: '#64748b' }}>Loading profile…</div>
  if (!profile) return (
    <div style={{ textAlign: 'center', padding: '6rem', color: '#64748b' }}>
      <FiAlertCircle size={40} style={{ marginBottom: 12 }} />
      <div>Restaurant profile not found. Please complete registration.</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1.5rem 90px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdRestaurantMenu color="#22c55e" />
            <span className="gradient-text">{profile.name}</span>
          </h1>
          <p style={{ color: '#64748b', marginTop: 6 }}>Restaurant Profile</p>
          <p style={{ color: '#f59e0b', marginTop: 4, fontWeight: 700, fontSize: '0.92rem' }}>
            Restaurant trust: {typeof profile.trust_rating === 'number' ? profile.trust_rating.toFixed(1) : '—'}⭐
          </p>
        </div>
        <button className="btn-secondary" onClick={() => setEditing(!editing)}>
          <FiEdit2 size={15} /> {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {/* Profile Card */}
      <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: 16 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Name', key: 'name' },
              { label: 'Address', key: 'address' },
              { label: 'Cuisine Type', key: 'cuisine_type' },
              { label: 'Phone', key: 'phone' },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>{label}</span>
                <input className="input-field" value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
            <button className="btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? '…' : <><FiCheck size={15} /> Save Changes</>}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {[
              { label: 'Address', value: profile.address },
              { label: 'Cuisine', value: profile.cuisine_type || 'Not set' },
              { label: 'Avg Daily Covers', value: profile.avg_daily_covers },
              { label: 'Reliability Score', value: `${(profile.reliability_score * 100).toFixed(0)}%` },
              { label: 'Average Review', value: typeof profile.avg_review_rating === 'number' ? `${profile.avg_review_rating.toFixed(1)}⭐` : 'No reviews' },
              { label: 'Trust Rating', value: typeof profile.trust_rating === 'number' ? `${profile.trust_rating.toFixed(1)}⭐` : 'No reviews' },
              { label: 'GSTIN', value: profile.gstin || 'Not verified' },
              { label: 'Member Since', value: profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GSTIN Checker */}
      <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <FiShield color="#22c55e" size={18} />
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>GSTIN Verification <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 500 }}>(Mock Validator)</span></h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          Enter your GSTIN to verify business identity. Use <code style={{ color: '#86efac', background: 'rgba(34,197,94,0.1)', padding: '1px 6px', borderRadius: 4 }}>22AAAAA0000A1Z5</code> for a demo pass.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input-field"
            placeholder="e.g. 22AAAAA0000A1Z5"
            value={gstin}
            onChange={e => { setGstin(e.target.value.toUpperCase()); setGstinResult(null) }}
            style={{ maxWidth: 260 }}
          />
          <button className="btn-primary" onClick={verifyGSTIN} disabled={gstinLoading || !gstin}>
            {gstinLoading ? '…' : <><FiShield size={14} /> Verify</>}
          </button>
        </div>
        {gstinResult && (
          <div style={{
            marginTop: '0.75rem', padding: '0.65rem 1rem', borderRadius: 10,
            background: gstinResult.verified ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${gstinResult.verified ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: gstinResult.verified ? '#4ade80' : '#f87171', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {gstinResult.verified ? <FiCheck size={16} /> : <FiX size={16} />}
            {gstinResult.message}
          </div>
        )}
      </div>

      {/* Donations */}
      <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiPackage color="#60a5fa" size={18} />
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>My Donations</h2>
          </div>
          <button className="btn-secondary" onClick={fetchAll} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
        {donations.length === 0 ? (
          <p style={{ color: '#475569', textAlign: 'center', padding: '2rem 0' }}>No donations yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {donations.map(d => (
              <div key={d.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                borderLeft: `3px solid ${STATUS_COLOR[d.status] || '#475569'}`,
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>#{d.id} — {d.food_type}</span>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                    {d.food_quantity} meals &nbsp;·&nbsp; NGO: {d.ngo_name}
                    {d.created_at && ` · ${new Date(d.created_at).toLocaleDateString('en-IN')}`}
                  </div>
                </div>
                <span style={{
                  padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                  background: `${STATUS_COLOR[d.status]}22`, color: STATUS_COLOR[d.status],
                  textTransform: 'capitalize',
                }}>
                  {d.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="glass" style={{ padding: '1.5rem', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <FiStar color="#f59e0b" size={18} />
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>Reviews Received ({reviews.length})</h2>
        </div>
        {reviews.length === 0
          ? <p style={{ color: '#475569', textAlign: 'center', padding: '1.5rem 0' }}>No reviews yet.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
            </div>
        }
      </div>
    </div>
  )
}
