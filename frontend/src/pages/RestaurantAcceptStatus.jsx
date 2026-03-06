import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiClock, FiRefreshCw } from 'react-icons/fi'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

const STATUS_FILTERS = ['all', 'matched', 'accepted', 'picked_up', 'delivered', 'pending']
const SOURCE_FILTERS = ['all', 'restaurant_donations', 'ngo_requests']
const POLL_INTERVAL_MS = 5_000

function isNgoRequest(item) {
  return String(item?.notes || '').includes('[NGO_REQUEST]')
}

const STATUS_COLOR = {
  pending: '#94a3b8',
  matched: '#60a5fa',
  accepted: '#fbbf24',
  picked_up: '#c084fc',
  delivered: '#22c55e',
}

export default function RestaurantAcceptStatus() {
  const { restaurantId } = useAuth()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  async function fetchStatus(silent = false) {
    if (!restaurantId) return
    if (!silent) setLoading(true)
    try {
      const data = await api.getDonations({ restaurant_id: restaurantId })
      setItems(data || [])
    } catch {
      if (!silent) setItems([])
    }
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    fetchStatus()
  }, [restaurantId]) // eslint-disable-line

  useEffect(() => {
    const timer = setInterval(() => fetchStatus(true), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [restaurantId]) // eslint-disable-line

  const filtered = useMemo(
    () => {
      const byStatus = filter === 'all' ? items : items.filter(item => item.status === filter)
      if (sourceFilter === 'all') return byStatus
      if (sourceFilter === 'ngo_requests') return byStatus.filter(isNgoRequest)
      return byStatus.filter(item => !isNgoRequest(item))
    },
    [items, filter, sourceFilter]
  )

  if (!restaurantId) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem 90px', color: '#94a3b8' }}>
        Restaurant profile is not linked yet. Please complete restaurant registration.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1.5rem 90px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiClock color="#22c55e" /> Request <span className="gradient-text">Status</span>
          </h1>
          <p style={{ color: '#64748b', marginTop: 6 }}>
            Track status for both donations created by your restaurant and NGO requests assigned to your restaurant.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/accept" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Back to Accept
          </Link>
          <button className="btn-secondary" onClick={() => fetchStatus()} disabled={loading}>
            <FiRefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {SOURCE_FILTERS.map(source => (
          <button
            key={source}
            onClick={() => setSourceFilter(source)}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: 999,
              border: `1px solid ${sourceFilter === source ? '#60a5fa' : 'rgba(255,255,255,0.1)'}`,
              background: sourceFilter === source ? 'rgba(96,165,250,0.14)' : 'transparent',
              color: sourceFilter === source ? '#93c5fd' : '#94a3b8',
              textTransform: 'capitalize',
              cursor: 'pointer',
              fontSize: '0.76rem',
              fontWeight: 600,
            }}
          >
            {source.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 999,
              border: `1px solid ${filter === status ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
              background: filter === status ? 'rgba(34,197,94,0.12)' : 'transparent',
              color: filter === status ? '#4ade80' : '#94a3b8',
              textTransform: 'capitalize',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          No requests found for this filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(item => (
            <div key={item.id} className="glass" style={{ padding: '0.95rem 1rem', borderRadius: 12, borderLeft: `3px solid ${STATUS_COLOR[item.status] || '#475569'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.ngo_name || `NGO #${item.ngo_id || '—'}`}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 3 }}>
                    Request #{item.id} · {item.food_quantity} meals · {item.food_type || 'mixed'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>
                    Source: {isNgoRequest(item) ? 'NGO request accepted by restaurant' : 'Donation created by restaurant'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                    Pickup carrier: {item.ngo_name || 'Waiting for NGO assignment'}
                  </div>
                </div>
                <span style={{ color: STATUS_COLOR[item.status] || '#94a3b8', fontWeight: 700, textTransform: 'capitalize', fontSize: '0.82rem' }}>
                  {item.status?.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
