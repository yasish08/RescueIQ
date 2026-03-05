import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiHeart, FiMap, FiBarChart2, FiTrendingUp, FiBell, FiSend } from 'react-icons/fi'
import { MdOutlineFoodBank, MdEco } from 'react-icons/md'
import StatCard from '../components/StatCard'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

const MOCK_IMPACT = { meals_rescued: 580, food_waste_prevented_kg: 203, co2_reduced_kg: 325, ngos_supported: 5, restaurants_participating: 8, donations_this_week: 12, trees_equivalent: 15 }
const NGO_DASHBOARD_POLL_MS = 5_000

export default function Dashboard() {
  const { user, restaurantId } = useAuth()
  const isDonor = user?.role === 'restaurant' || user?.role === 'provider'
  const [impact, setImpact] = useState(MOCK_IMPACT)
  const [liveAlerts, setLiveAlerts] = useState([])

  useEffect(() => {
    api.getImpact().then(setImpact).catch(() => {})
    const dow = new Date().getDay()

    if (isDonor && restaurantId) {
      Promise.all([
        api.predict({ restaurant_id: restaurantId, day_of_week: dow }),
        api.getRestaurantProfile(user.id).catch(() => null),
      ])
        .then(([prediction, profile]) => {
          const name = profile?.restaurant?.name || prediction?.restaurant_name || `Restaurant #${restaurantId}`
          const alert = prediction?.exceeds_threshold ? [{ ...prediction, restaurant_name: name }] : []
          setLiveAlerts(alert)
        })
        .catch(() => setLiveAlerts([]))
      return
    }

    const toNgoAlert = (donation) => ({
      restaurant_id: donation.restaurant_id,
      recommendation: `${donation.food_quantity} meals available for pickup`,
      restaurant_name: donation.restaurant_name || `Restaurant #${donation.restaurant_id}`,
    })

    const loadNgoAlerts = () => api.getDonations()
      .then((items) => {
        const open = (items || [])
          .filter(item => item.status === 'pending' || item.status === 'matched')
          .slice(0, 3)
        setLiveAlerts(open.map(toNgoAlert))
      })
      .catch(() => setLiveAlerts([]))

    loadNgoAlerts()
    const timer = setInterval(loadNgoAlerts, NGO_DASHBOARD_POLL_MS)
    return () => clearInterval(timer)
  }, [user, restaurantId, isDonor])

  const primaryCta = user?.role === 'ngo'
    ? { to: '/request', label: 'Request Food Support' }
    : { to: '/predict', label: 'Donate Surplus Food' }

  const quickActions = user?.role === 'ngo'
    ? [
        { to: '/request', icon: FiSend, label: 'Request Food', desc: 'Submit your requirement and route it to likely-surplus restaurants', color: '#22c55e' },
        { to: '/ngo', icon: FiHeart, label: 'Accept Pickups', desc: 'Manage assigned pickups and update delivery status', color: '#c084fc' },
        { to: '/map', icon: FiMap, label: 'Live Map', desc: 'See active requests and nearby partners', color: '#60a5fa' },
        { to: '/impact', icon: FiBarChart2, label: 'Our Impact', desc: 'Meals saved, waste avoided, and CO2 reduced', color: '#f59e0b' },
      ]
    : [
        { to: '/predict', icon: FiSend, label: 'Donate Food', desc: 'Tell us what you have and we will find the right NGO instantly', color: '#22c55e' },
        { to: '/impact', icon: FiBarChart2, label: 'Insights', desc: 'Track your rescue impact and trend over time', color: '#f59e0b' },
        { to: '/map', icon: FiMap, label: 'Live Map', desc: 'See active donations and pickup routes near you', color: '#60a5fa' },
        { to: '/profile', icon: FiHeart, label: 'Profile', desc: 'Manage restaurant details and verification info', color: '#c084fc' },
      ]

  return (
    <div style={{ paddingTop: '1.5rem', paddingBottom: '90px', minHeight: '100dvh' }}>
      <section style={{ padding: '3rem 1.5rem 2rem', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1rem' }}>
          Less Waste. <span className="gradient-text">More Impact.</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          RescueIQ connects restaurants with surplus food to nearby NGOs automatically and in minutes.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={primaryCta.to}><button className="btn-primary" style={{ fontSize: '1rem', padding: '0.9rem 2rem' }}><FiSend size={18} /> {primaryCta.label}</button></Link>
          <Link to="/impact"><button className="btn-secondary" style={{ fontSize: '1rem', padding: '0.9rem 2rem' }}><FiBarChart2 size={18} /> See Our Impact</button></Link>
        </div>
      </section>

      <section style={{ padding: '0 1.5rem 3rem', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <StatCard label="Meals Rescued" value={impact.meals_rescued} icon={MdOutlineFoodBank} color="#22c55e" delay={0} />
          <StatCard label="Waste Prevented" value={impact.food_waste_prevented_kg} suffix=" kg" icon={FiTrendingUp} color="#f59e0b" delay={100} />
          <StatCard label="CO2 Reduced" value={impact.co2_reduced_kg} suffix=" kg" icon={MdEco} color="#60a5fa" delay={200} />
          <StatCard label="NGOs Supported" value={impact.ngos_supported} icon={FiHeart} color="#c084fc" delay={300} />
        </div>
      </section>

      {liveAlerts.length > 0 && (
        <section style={{ padding: '0 1.5rem 3rem', maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiBell color="#f59e0b" size={18} /> Live Surplus Alerts
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {liveAlerts.map(alert => (
              <div key={alert.restaurant_id} className="glass" style={{
                padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderLeft: '3px solid #f59e0b',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{alert.restaurant_name || `Restaurant #${alert.restaurant_id}`}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{alert.recommendation}</div>
                </div>
                <Link to={user?.role === 'ngo' ? '/request' : '/predict'}>
                  <button className="btn-amber" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiSend size={14} /> {user?.role === 'ngo' ? 'Request' : 'Donate'}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ padding: '0 1.5rem 3rem', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {quickActions.map(({ to, icon: Icon, label, desc, color }) => (
            <Link key={to} to={to} style={{ textDecoration: 'none' }}>
              <div className="glass" style={{
                padding: '1.5rem', cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${color}22` }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                  <Icon color={color} size={22} />
                </div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
