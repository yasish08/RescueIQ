import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { FiRefreshCw, FiBarChart2 } from 'react-icons/fi'
import { MdOutlineFoodBank, MdEco, MdRecycling } from 'react-icons/md'
import { FaHandsHelping, FaUtensils, FaTree, FaCar, FaTint, FaBolt } from 'react-icons/fa'
import { api } from '../api/client'

const MOCK_TIMELINE = [
  { week: 'Jan 05', meals_rescued: 20, co2_reduced: 11.2, waste_prevented: 7 },
  { week: 'Jan 12', meals_rescued: 35, co2_reduced: 19.6, waste_prevented: 12.3 },
  { week: 'Jan 19', meals_rescued: 45, co2_reduced: 25.2, waste_prevented: 15.8 },
  { week: 'Jan 26', meals_rescued: 62, co2_reduced: 34.7, waste_prevented: 21.7 },
  { week: 'Feb 02', meals_rescued: 75, co2_reduced: 42, waste_prevented: 26.3 },
  { week: 'Feb 09', meals_rescued: 95, co2_reduced: 53.2, waste_prevented: 33.3 },
  { week: 'Feb 16', meals_rescued: 120, co2_reduced: 67.2, waste_prevented: 42 },
  { week: 'Feb 23', meals_rescued: 138, co2_reduced: 77.3, waste_prevented: 48.3 },
]

const MOCK_IMPACT = { meals_rescued: 580, food_waste_prevented_kg: 203, co2_reduced_kg: 325, ngos_supported: 5, restaurants_participating: 8, donations_this_week: 12, trees_equivalent: 15 }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.75rem 1rem' }}>
      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 8 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontSize: '0.85rem', fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

export default function ImpactDashboard() {
  const [timeline, setTimeline] = useState(MOCK_TIMELINE)
  const [impact, setImpact] = useState(MOCK_IMPACT)
  const [activeChart, setActiveChart] = useState('meals')
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [imp, tl] = await Promise.all([api.getImpact(), api.getTimeline()])
      setImpact(imp)
      if (tl.length > 0) setTimeline(tl)
    } catch { /* use mock */ }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const chartConfigs = {
    meals: { key: 'meals_rescued', color: '#22c55e', label: 'Meals Rescued', type: 'area' },
    co2: { key: 'co2_reduced', color: '#60a5fa', label: 'CO₂ Reduced (kg)', type: 'bar' },
    waste: { key: 'waste_prevented', color: '#f59e0b', label: 'Waste Prevented (kg)', type: 'area' },
  }

  const cfg = chartConfigs[activeChart]

  const summaryCards = [
        { label: 'Meals Rescued', value: impact.meals_rescued, unit: '', color: '#22c55e', Icon: MdOutlineFoodBank },
        { label: 'CO₂ Reduced', value: impact.co2_reduced_kg, unit: ' kg', color: '#60a5fa', Icon: MdEco },
        { label: 'Waste Prevented', value: impact.food_waste_prevented_kg, unit: ' kg', color: '#f59e0b', Icon: MdRecycling },
        { label: 'NGOs Supported', value: impact.ngos_supported, unit: '', color: '#c084fc', Icon: FaHandsHelping },
        { label: 'Restaurants', value: impact.restaurants_participating, unit: '', color: '#fb923c', Icon: FaUtensils },
        { label: 'Trees Equivalent', value: impact.trees_equivalent, unit: '', color: '#4ade80', Icon: FaTree },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.5rem 90px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display:'flex', alignItems:'center', gap:10 }}><FiBarChart2 color="#22c55e" /> Impact <span className="gradient-text">Analytics</span></h1>
          <p style={{ color: '#64748b', marginTop: 6 }}>Track the real-world environmental and social impact of RescueIQ.</p>
        </div>
        <button className="btn-secondary" onClick={fetchData} disabled={loading}>
          <FiRefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.875rem', marginBottom: '2rem' }}>
        {summaryCards.map(({ label, value, unit, color, Icon }) => (
          <div key={label} className="glass" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:`${color}22`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon color={color} size={20} />
              </div>
            </div>
            <div style={{ color, fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Space Grotesk', lineHeight: 1 }}>
              {Number(value).toLocaleString()}<span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>{unit}</span>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 6, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Chart selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {Object.entries(chartConfigs).map(([key, c]) => (
          <button key={key} onClick={() => setActiveChart(key)} style={{
            padding: '0.4rem 1rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${activeChart === key ? c.color : 'rgba(255,255,255,0.1)'}`,
            background: activeChart === key ? `${c.color}22` : 'transparent',
            color: activeChart === key ? c.color : '#64748b',
          }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Main chart */}
      <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1.25rem' }}>{cfg.label} — Last 8 Weeks</div>
        <ResponsiveContainer width="100%" height={280}>
          {cfg.type === 'area' ? (
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={cfg.key} stroke={cfg.color} strokeWidth={2.5} fill="url(#grad)" name={cfg.label} dot={{ fill: cfg.color, r: 4 }} />
            </AreaChart>
          ) : (
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={cfg.key} fill={cfg.color} radius={[4, 4, 0, 0]} name={cfg.label} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Multi-line comparison chart */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1.25rem' }}>All Metrics Comparison</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '0.82rem' }} />
            <Line type="monotone" dataKey="meals_rescued" stroke="#22c55e" strokeWidth={2} dot={false} name="Meals" />
            <Line type="monotone" dataKey="co2_reduced" stroke="#60a5fa" strokeWidth={2} dot={false} name="CO₂ (kg)" />
            <Line type="monotone" dataKey="waste_prevented" stroke="#f59e0b" strokeWidth={2} dot={false} name="Waste (kg)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Environmental equivalents */}
      <div style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: 14, background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,163,74,0.03))', border: '1px solid rgba(34,197,94,0.15)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem', display:'flex', alignItems:'center', gap:8 }}><MdEco color="#22c55e" size={20}/> Environmental Equivalents</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {[
            { Icon: FaTree, value: impact.trees_equivalent, label: 'trees worth of CO₂ absorbed', color: '#4ade80' },
            { Icon: FaCar, value: Math.round(impact.co2_reduced_kg / 0.21), label: 'km of car travel avoided', color: '#60a5fa' },
            { Icon: FaTint, value: Math.round(impact.food_waste_prevented_kg * 50), label: 'litres of water saved', color: '#38bdf8' },
            { Icon: FaBolt, value: Math.round(impact.food_waste_prevented_kg * 4.5), label: 'kWh of energy saved', color: '#fbbf24' },
          ].map(({ Icon, value, label, color }) => (
            <div key={label} style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`${color}22`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon color={color} size={20} />
                </div>
              </div>
              <div style={{ color, fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Space Grotesk' }}>{value.toLocaleString()}</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.4, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
