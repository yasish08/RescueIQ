import { useEffect, useRef, useState } from 'react'

export default function StatCard({ label, value, suffix = '', icon: Icon, color = '#22c55e', delay = 0 }) {
  const [displayed, setDisplayed] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const target = Number(value) || 0
      const duration = 1200
      const step = Math.ceil(target / (duration / 16))
      let current = 0
      const interval = setInterval(() => {
        current = Math.min(current + step, target)
        setDisplayed(current)
        if (current >= target) clearInterval(interval)
      }, 16)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return (
    <div ref={ref} className="glass fade-in" style={{
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${color}22` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Background glow orb */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: color, opacity: 0.08, filter: 'blur(20px)',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        {Icon && (
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${color}22`, border: `1px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon color={color} size={18} />
          </div>
        )}
      </div>
      <div className="stat-number" style={{ color }}>
        {displayed.toLocaleString()}<span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}>{suffix}</span>
      </div>
    </div>
  )
}
