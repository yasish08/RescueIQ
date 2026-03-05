import { FiStar, FiUser } from 'react-icons/fi'

function Stars({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <FiStar key={i} size={14}
          style={{ color: i <= rating ? '#f59e0b' : '#334155', fill: i <= rating ? '#f59e0b' : 'none' }} />
      ))}
    </div>
  )
}

export default function ReviewCard({ review }) {
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div className="glass" style={{ padding: '1rem 1.25rem', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#22c55e,#86efac)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FiUser size={14} color="#0a0f1e" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{review.reviewer_name || 'Anonymous'}</div>
            <Stars rating={review.rating} />
          </div>
        </div>
        <div style={{ color: '#475569', fontSize: '0.75rem' }}>{date}</div>
      </div>
      {review.comment && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6, marginTop: 8 }}>
          {review.comment}
        </p>
      )}
    </div>
  )
}

/** Interactive star picker for writing reviews */
export function StarPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <FiStar size={24}
            style={{ color: i <= value ? '#f59e0b' : '#334155', fill: i <= value ? '#f59e0b' : 'none', transition: 'all 0.15s' }} />
        </button>
      ))}
    </div>
  )
}
