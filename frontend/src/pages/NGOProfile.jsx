import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiX, FiShield, FiStar, FiEdit2, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import { MdVolunteerActivism } from 'react-icons/md'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import ReviewCard from '../components/ReviewCard'

export default function NGOProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  // Certificate checker
  const [cert, setCert] = useState('')
  const [certResult, setCertResult] = useState(null)
  const [certLoading, setCertLoading] = useState(false)

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
      const data = await api.getNGOProfile(user.id)
      setProfile(data.ngo)
      setCert(data.ngo.certificate_number || '')
      setForm({
        name: data.ngo.name,
        address: data.ngo.address,
        phone: data.user?.phone || '',
      })
      const r = await api.getReviews(user.id)
      setReviews(r)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function verifyCert() {
    if (!cert) return
    setCertLoading(true)
    try {
      const res = await api.verifyCertificate(cert)
      setCertResult(res)
      if (res.verified) {
        await api.updateNGOProfile(user.id, { certificate_number: cert })
        setProfile(p => ({ ...p, certificate_number: cert }))
      }
    } catch { setCertResult({ verified: false, message: '❌ Verification failed' }) }
    setCertLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await api.updateNGOProfile(user.id, form)
      setProfile(p => ({ ...p, ...form }))
      setEditing(false)
    } catch { }
    setSaving(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '6rem', color: '#64748b' }}>Loading profile…</div>
  if (!profile) return (
    <div style={{ textAlign: 'center', padding: '6rem', color: '#64748b' }}>
      <FiAlertCircle size={40} style={{ marginBottom: 12 }} />
      <div>NGO profile not found. Please complete registration.</div>
    </div>
  )

  const capacityPct = Math.round((profile.current_load / profile.capacity) * 100)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1.5rem 90px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdVolunteerActivism color="#c084fc" />
            <span style={{ background: 'linear-gradient(135deg,#c084fc,#e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {profile.name}
            </span>
          </h1>
          <p style={{ color: '#64748b', marginTop: 6 }}>NGO Profile</p>
          <p style={{ color: '#f59e0b', marginTop: 4, fontWeight: 700, fontSize: '0.92rem' }}>
            NGO trust: {typeof profile.trust_rating === 'number' ? profile.trust_rating.toFixed(1) : '—'}⭐
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
              { label: 'Organisation Name', key: 'name' },
              { label: 'Address', key: 'address' },
              { label: 'Phone', key: 'phone' },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>{label}</span>
                <input className="input-field" value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
            <button className="btn-primary" onClick={saveProfile} disabled={saving}
              style={{ background: 'linear-gradient(135deg,#c084fc,#a855f7)' }}>
              {saving ? '…' : <><FiCheck size={15} /> Save Changes</>}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Address', value: profile.address },
                { label: 'Capacity', value: `${profile.capacity} units` },
                { label: 'Urgency Score', value: `${(profile.urgency_score * 100).toFixed(0)}%` },
                { label: 'Reliability', value: `${(profile.reliability_score * 100).toFixed(0)}%` },
                { label: 'Average Review', value: typeof profile.avg_review_rating === 'number' ? `${profile.avg_review_rating.toFixed(1)}⭐` : 'No reviews' },
                { label: 'Trust Rating', value: typeof profile.trust_rating === 'number' ? `${profile.trust_rating.toFixed(1)}⭐` : 'No reviews' },
                { label: 'Certificate', value: profile.certificate_number || 'Not verified' },
                { label: 'Member Since', value: profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Capacity bar */}
            <div>
              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, marginBottom: 6 }}>
                Capacity Usage — {profile.current_load} / {profile.capacity}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999, transition: 'width 0.5s ease',
                  width: `${capacityPct}%`,
                  background: capacityPct > 80 ? '#ef4444' : capacityPct > 50 ? '#f59e0b' : '#c084fc',
                }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Certificate Checker */}
      <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <FiShield color="#c084fc" size={18} />
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            NGO Certificate Verification <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 500 }}>(Mock Validator)</span>
          </h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          Enter your NGO registration certificate number. Use{' '}
          <code style={{ color: '#c084fc', background: 'rgba(192,132,252,0.1)', padding: '1px 6px', borderRadius: 4 }}>NGO/12345678/2024</code>{' '}
          for a demo pass.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input-field"
            placeholder="e.g. NGO/12345678/2024"
            value={cert}
            onChange={e => { setCert(e.target.value.toUpperCase()); setCertResult(null) }}
            style={{ maxWidth: 260 }}
          />
          <button onClick={verifyCert} disabled={certLoading || !cert}
            style={{
              padding: '0.75rem 1.25rem', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#c084fc,#a855f7)', color: '#fff', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, opacity: certLoading || !cert ? 0.6 : 1,
            }}>
            {certLoading ? '…' : <><FiShield size={14} /> Verify</>}
          </button>
        </div>
        {certResult && (
          <div style={{
            marginTop: '0.75rem', padding: '0.65rem 1rem', borderRadius: 10,
            background: certResult.verified ? 'rgba(192,132,252,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${certResult.verified ? 'rgba(192,132,252,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: certResult.verified ? '#c084fc' : '#f87171', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {certResult.verified ? <FiCheck size={16} /> : <FiX size={16} />}
            {certResult.message}
          </div>
        )}
      </div>

      {/* Reviews Received */}
      <div className="glass" style={{ padding: '1.5rem', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiStar color="#f59e0b" size={18} />
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>Reviews Received ({reviews.length})</h2>
          </div>
          <button className="btn-secondary" onClick={fetchAll} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            <FiRefreshCw size={14} /> Refresh
          </button>
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
