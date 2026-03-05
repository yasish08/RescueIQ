export default function DonationCard({ donation, onAccept, onUpdateStatus }) {
  const statusClass = `badge badge-${donation.status}`
  const canAccept = donation.status === 'matched' || donation.status === 'pending'

  return (
    <div className="glass fade-in" style={{
      padding: '1.25rem',
      transition: 'transform 0.2s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
            {donation.restaurant_name || `Restaurant #${donation.restaurant_id}`}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
            #{donation.id} · {donation.food_type}
          </div>
        </div>
        <span className={statusClass}>{donation.status}</span>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Qty</div>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.2rem' }}>{donation.food_quantity} meals</div>
        </div>
        {donation.ngo_name && (
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>NGO</div>
            <div style={{ fontWeight: 600 }}>{donation.ngo_name}</div>
          </div>
        )}
        {donation.pickup_time && (
          <div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pickup</div>
            <div style={{ fontWeight: 600 }}>{donation.pickup_time}</div>
          </div>
        )}
      </div>

      {canAccept && onAccept && (
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onAccept(donation.id)}>
          {donation.status === 'pending' ? 'Claim & Accept Pickup' : 'Accept Pickup'}
        </button>
      )}
      {donation.status === 'accepted' && onUpdateStatus && (
        <button className="btn-amber" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onUpdateStatus(donation.id, 'picked_up')}>
          Mark Picked Up
        </button>
      )}
      {donation.status === 'picked_up' && onUpdateStatus && (
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onUpdateStatus(donation.id, 'delivered')}>
          Mark Delivered
        </button>
      )}
    </div>
  )
}
