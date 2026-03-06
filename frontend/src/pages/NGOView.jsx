import { useState, useEffect, useRef } from 'react'
import { FiRefreshCw, FiHeart, FiBell } from 'react-icons/fi'
import DonationCard from '../components/DonationCard'
import { api } from '../api/client'
import { pushNotification } from '../components/NotificationBell'
import { useAuth } from '../context/AuthContext'

const STATUS_FILTERS = ['all', 'matched', 'accepted', 'picked_up', 'delivered', 'pending']
const POLL_INTERVAL_MS = 5_000
const ACTIONABLE_STATUSES = new Set(['pending', 'matched', 'accepted', 'picked_up'])

function isUpcomingDonation(item) {
  if (!item || !ACTIONABLE_STATUSES.has(item.status)) return false

  const now = Date.now()
  const pickupTs = item.pickup_time ? Date.parse(item.pickup_time) : NaN
  if (!Number.isNaN(pickupTs)) {
    return pickupTs >= now - (2 * 60 * 60 * 1000)
  }

  const createdTs = item.created_at ? Date.parse(item.created_at) : NaN
  if (!Number.isNaN(createdTs)) {
    return createdTs >= now - (36 * 60 * 60 * 1000)
  }

  return false
}

export default function NGOView() {
  const { ngoId } = useAuth()
  const [donations, setDonations] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const prevCountRef = useRef(0)

  async function fetchDonations(silent = false) {
    if (!silent) setLoading(true)
    try {
      const data = await api.getDonations()
      const scoped = ngoId
        ? data.filter(item => item.ngo_id === ngoId || (!item.ngo_id && (item.status === 'pending' || item.status === 'matched')))
        : data
      const upcomingOnly = scoped.filter(isUpcomingDonation)
      const newCount = upcomingOnly.length
      const prevCount = prevCountRef.current
      if (newCount > prevCount) {
        const diff = newCount - prevCount
        const msg = `${diff} new donation${diff > 1 ? 's' : ''} arrived`
        setToast(msg)
        pushNotification(msg, 'success')
        setTimeout(() => setToast(null), 5000)
      }
      prevCountRef.current = newCount
      setDonations(upcomingOnly)
    } catch {
      if (!silent) pushNotification('Could not refresh donations', 'error')
    }
    if (!silent) setLoading(false)
  }

  useEffect(() => { fetchDonations() }, [ngoId]) // eslint-disable-line

  useEffect(() => {
    const timer = setInterval(() => fetchDonations(true), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [ngoId]) // eslint-disable-line

  const handleAccept = async (id) => {
    try { await api.updateDonation(id, { status: 'accepted', ngo_id: ngoId }) } catch { /* optimistic */ }
    setDonations(d => d.map(x => x.id === id ? { ...x, status: 'accepted', ngo_id: ngoId } : x))
    pushNotification(`Donation #${id} accepted`, 'success')
  }

  const handleUpdateStatus = async (id, status) => {
    try { await api.updateDonation(id, { status }) } catch { /* optimistic */ }
    setDonations(d => d.map(x => x.id === id ? { ...x, status } : x))
    pushNotification(`Donation #${id} -> ${status.replace('_', ' ')}`, 'info')
  }

  const filtered = filter === 'all' ? donations : donations.filter(d => d.status === filter)
  const counts = STATUS_FILTERS.slice(1).reduce((acc, s) => {
    acc[s] = donations.filter(d => d.status === s).length
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1.5rem 90px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
          color: '#4ade80', padding: '0.6rem 1.25rem', borderRadius: 999,
          fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8,
          backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(34,197,94,0.2)',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <FiBell size={14} /> {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiHeart color="#22c55e" /> Pickup <span className="gradient-text">Requests</span>
          </h1>
          <p style={{ color: '#64748b', marginTop: 6 }}>
            As pickup carrier, accept and update only upcoming requests (accepted → picked up → delivered).
          </p>
        </div>
        <button className="btn-secondary" onClick={() => fetchDonations()} disabled={loading}>
          <FiRefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { label: 'New Requests', count: donations.filter(d => d.status === 'matched' || d.status === 'pending').length, color: '#60a5fa' },
          { label: 'Accepted', count: counts.accepted || 0, color: '#fbbf24' },
          { label: 'In Transit', count: counts.picked_up || 0, color: '#c084fc' },
          { label: 'Delivered', count: counts.delivered || 0, color: '#22c55e' },
        ].map(({ label, count, color }) => (
          <div key={label} className="glass" style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap', minWidth: 120 }}>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 4 }}>{label}</div>
            <div style={{ color, fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Space Grotesk' }}>{count}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '0.4rem 1rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600,
            border: `1px solid ${filter === s ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
            background: filter === s ? 'rgba(34,197,94,0.15)' : 'transparent',
            color: filter === s ? '#4ade80' : '#64748b', cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {s.replace('_', ' ')} {s !== 'all' && counts[s] ? `(${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#475569' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>No items</div>
          <div>No donations in this category yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(d => (
            <DonationCard key={d.id} donation={d} onAccept={handleAccept} onUpdateStatus={handleUpdateStatus} />
          ))}
        </div>
      )}
    </div>
  )
}
