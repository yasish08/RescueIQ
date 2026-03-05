import { useState } from 'react'
import { FiSend, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

export default function NGORequest() {
  const { ngoId, user } = useAuth()
  const [requestedQuantity, setRequestedQuantity] = useState('')
  const [foodType, setFoodType] = useState('mixed')
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const submitRequest = async () => {
    if (!requestedQuantity || Number(requestedQuantity) <= 0) {
      setError('Please enter a valid requested quantity.')
      return
    }

    setError('')
    setLoading(true)
    try {
      let resolvedNgoId = ngoId
      if (!resolvedNgoId && user?.id) {
        const profileData = await api.getNGOProfile(user.id).catch(() => null)
        resolvedNgoId = profileData?.ngo?.id || null
      }
      if (!resolvedNgoId) {
        setError('NGO profile is not linked yet. Please open Profile once and try again.')
        setLoading(false)
        return
      }

      const payload = {
        ngo_id: resolvedNgoId,
        requested_quantity: Number(requestedQuantity),
        food_type: foodType || 'mixed',
        needed_by: neededBy ? new Date(neededBy).toISOString() : null,
        notes: notes || null,
      }
      const res = await api.createNGORequest(payload)
      setResult(res)
      setRequestedQuantity('')
      setFoodType('mixed')
      setNeededBy('')
      setNotes('')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not submit request. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '2rem 1.25rem 100px' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
        Request <span className="gradient-text">Food Support</span>
      </h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Submit your requirement and RescueIQ will route it to the best available restaurant.
      </p>

      <div className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
            REQUIRED MEALS *
          </label>
          <input
            className="input-field"
            type="number"
            min={1}
            placeholder="e.g. 60"
            value={requestedQuantity}
            onChange={e => setRequestedQuantity(e.target.value)}
          />
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
            FOOD TYPE PREFERENCE
          </label>
          <input
            className="input-field"
            placeholder="e.g. cooked meals, rice, mixed"
            value={foodType}
            onChange={e => setFoodType(e.target.value)}
          />
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
            NEEDED BY
          </label>
          <input
            className="input-field"
            type="datetime-local"
            value={neededBy}
            onChange={e => setNeededBy(e.target.value)}
          />
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
            NOTES
          </label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="Any urgency notes or special handling details"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: '0.875rem' }}>
            <FiAlertCircle /> {error}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={submitRequest}
          disabled={loading}
        >
          <FiSend size={16} />
          {loading ? 'Submitting request...' : 'Submit Request'}
        </button>
      </div>

      {result?.request && (
        <div className="glass" style={{ padding: '1.25rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', marginBottom: 8, fontWeight: 700 }}>
            <FiCheckCircle /> Request created
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Request #{result.request.id} is now pending.
          </div>
          {result.recommended_restaurant && (
            <div style={{ marginTop: 8, color: '#cbd5e1' }}>
              Suggested restaurant: <strong>{result.recommended_restaurant.name}</strong>
              {' '}({result.recommended_restaurant.predicted_surplus} predicted surplus)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
