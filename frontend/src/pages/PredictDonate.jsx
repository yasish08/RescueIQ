import { useState, useRef, useEffect, useMemo } from 'react'
import { FiCheckCircle, FiSend, FiMessageSquare, FiAlertCircle, FiMapPin } from 'react-icons/fi'
import { MdOutlineRestaurantMenu } from 'react-icons/md'
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES = ['places']

const STEPS = ['Your Restaurant', 'Describe Surplus', 'Confirm Donation']

export default function PredictDonate() {
  const { user, restaurantId: authRestaurantId } = useAuth()
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_API_KEY, libraries: LIBRARIES })
  const autocompleteRef = useRef(null)

  const [step, setStep] = useState(0)
  const [restaurantId, setRestaurantId] = useState(authRestaurantId || 1)
  const [restaurantName, setRestaurantName] = useState('')

  // Step 2 — surplus details
  const [nlpText, setNlpText] = useState('')
  const [nlpParsing, setNlpParsing] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [foodType, setFoodType] = useState('mixed')
  const [pickupTime, setPickupTime] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [pickupLatLng, setPickupLatLng] = useState(null)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [notes, setNotes] = useState('')

  // Step 3 — result
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDonation, setConfirmingDonation] = useState(false)
  const [result, setResult] = useState(null)
  const [nearbySuggestions, setNearbySuggestions] = useState([])
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [skippedSuggestionKeys, setSkippedSuggestionKeys] = useState([])
  const [confirmedNgoName, setConfirmedNgoName] = useState('')
  const [error, setError] = useState('')

  const restaurant = { id: restaurantId, name: restaurantName || `Restaurant #${restaurantId}` }

  useEffect(() => {
    if (!authRestaurantId) return
    setRestaurantId(authRestaurantId)
  }, [authRestaurantId])

  useEffect(() => {
    if (!user?.id) return
    api.getRestaurantProfile(user.id)
      .then((data) => {
        if (data?.restaurant?.id) setRestaurantId(data.restaurant.id)
        if (data?.restaurant?.name) setRestaurantName(data.restaurant.name)
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  // Called when user picks a place in the autocomplete dropdown
  const onPlaceChanged = () => {
    if (!autocompleteRef.current) return
    const place = autocompleteRef.current.getPlace()
    if (place?.geometry?.location) {
      setPickupLatLng({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
      setPickupLocation(place.formatted_address || place.name || '')
    }
  }

  const parseText = async () => {
    if (!nlpText.trim()) return
    setNlpParsing(true)
    try {
      const res = await api.parseText(nlpText)
      if (res.quantity) setQuantity(String(res.quantity))
      if (res.food_type) setFoodType(res.food_type)
      if (res.time) setPickupTime(res.time)
    } catch { /* silently ignore — user can fill form manually */ }
    setNlpParsing(false)
    setStep(2)
  }

  const submitDonation = async () => {
    if (!quantity) { setError('Please enter a quantity.'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await api.createDonation({
        restaurant_id: restaurantId,
        food_quantity: Number(quantity),
        food_type: foodType,
        pickup_time: pickupTime || null,
        pickup_lat: pickupLatLng?.lat ?? currentLocation?.lat ?? null,
        pickup_lng: pickupLatLng?.lng ?? currentLocation?.lng ?? null,
        notes: notes || null,
        auto_match: true,
      })
      setResult(res)
      setNearbySuggestions([])
      setSuggestionIndex(0)
      setSkippedSuggestionKeys([])
      setConfirmedNgoName('')
      setStep(3)
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(detail || 'Could not submit donation. Please check your connection.')
    }
    setSubmitting(false)
  }

  const reset = () => {
    setStep(0); setResult(null); setError(''); setQuantity(''); setNlpText('');
    setNotes(''); setPickupLocation(''); setPickupLatLng(null); setNearbySuggestions([])
    setSuggestionIndex(0); setSkippedSuggestionKeys([]); setConfirmedNgoName('')
  }

  useEffect(() => {
    if (step !== 3 || !result) return
    if (result.matched_ngo || result.suggested_ngo) return
    const base = pickupLatLng || currentLocation
    if (!base) return

    const fallbackBrowserPlaces = () => {
      if (!window.google?.maps?.places) return
      const service = new window.google.maps.places.PlacesService(document.createElement('div'))
      service.textSearch(
        { query: 'non profit organization', location: base, radius: 25000 },
        (items, status) => {
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !Array.isArray(items)) return
          const parsed = items.slice(0, 3).map((item) => {
            const lat = item?.geometry?.location?.lat?.()
            const lng = item?.geometry?.location?.lng?.()
            const distance = (lat != null && lng != null)
              ? Math.round((Math.hypot(lat - base.lat, lng - base.lng) * 111) * 10) / 10
              : null
            return {
              id: item.place_id || `${item.name}-${lat}-${lng}`,
              name: item.name || 'Nearby NGO',
              address: item.formatted_address || item.vicinity || '',
              distance_km: distance,
            }
          })
          if (parsed.length) setNearbySuggestions(parsed)
        }
      )
    }

    api.nearbyNGOs(base.lat, base.lng, 5, 5, 25)
      .then((res) => {
        const items = (res?.ngos || []).slice(0, 3)
        if (items.length) {
          setNearbySuggestions(items)
          return
        }
        fallbackBrowserPlaces()
      })
      .catch(() => fallbackBrowserPlaces())
  }, [step, result, pickupLatLng, currentLocation])

  const suggestionList = useMemo(() => {
    const merged = []
    const seen = new Set()
    const skipped = new Set(skippedSuggestionKeys)
    const getKey = (item) => {
      if (item?.id != null) return `id:${String(item.id)}`
      const lat = item?.lat ?? ''
      const lng = item?.lng ?? ''
      return `name:${(item?.name || '').toLowerCase()}|coord:${lat}|${lng}`
    }
    const add = (item) => {
      if (!item) return
      const key = getKey(item)
      if (seen.has(key)) return
      if (skipped.has(key)) return
      seen.add(key)
      merged.push(item)
    }
    add(result?.suggested_ngo)
    ;(nearbySuggestions || []).forEach(add)
    return merged
  }, [result?.suggested_ngo, nearbySuggestions, skippedSuggestionKeys])

  const activeSuggestion = suggestionList[suggestionIndex] || null

  const skipSuggestion = () => {
    if (!activeSuggestion) return
    const key = activeSuggestion?.id != null
      ? `id:${String(activeSuggestion.id)}`
      : `name:${(activeSuggestion?.name || '').toLowerCase()}|coord:${activeSuggestion?.lat ?? ''}|${activeSuggestion?.lng ?? ''}`
    setSkippedSuggestionKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
    setSuggestionIndex(0)
  }

  const confirmDonationAtNgo = async () => {
    if (!activeSuggestion || !result?.donation?.id) return
    setConfirmingDonation(true)
    const currentNotes = result?.donation?.notes || notes || ''
    const confirmText = `[CONFIRMED_NGO] ${activeSuggestion.name}${activeSuggestion.address ? ` | ${activeSuggestion.address}` : ''}`
    const mergedNotes = currentNotes ? `${currentNotes}\n${confirmText}` : confirmText

    const rawNgoId = activeSuggestion.db_ngo_id ?? activeSuggestion.id
    let ngoId = null
    if (typeof rawNgoId === 'number' && Number.isInteger(rawNgoId)) ngoId = rawNgoId
    if (typeof rawNgoId === 'string' && /^\d+$/.test(rawNgoId)) ngoId = Number(rawNgoId)

    try {
      const payload = { status: 'matched', notes: mergedNotes }
      if (ngoId != null) payload.ngo_id = ngoId
      try {
        await api.updateDonation(result.donation.id, payload)
      } catch (error) {
        // If suggestion is an external place and not an internal NGO ID, retry without ngo_id.
        if (ngoId != null) {
          await api.updateDonation(result.donation.id, { status: 'matched', notes: mergedNotes })
        } else {
          throw error
        }
      }
      setConfirmedNgoName(activeSuggestion.name || 'Selected NGO')
      setResult((prev) => prev ? ({ ...prev, donation: { ...prev.donation, status: 'matched', notes: mergedNotes } }) : prev)
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(detail || 'Could not confirm donation for this NGO.')
    }
    setConfirmingDonation(false)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.25rem 100px' }}>

      {/* Progress bar */}
      {step < 3 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{
                fontSize: '0.75rem', fontWeight: 600,
                color: i === step ? '#22c55e' : i < step ? '#4ade80' : '#475569',
              }}>{i < step ? '✓ ' : ''}{s}</span>
            ))}
          </div>
          <div style={{ height: 4, background: '#1e293b', borderRadius: 99 }}>
            <div style={{
              height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#22c55e,#86efac)',
              width: `${((step) / (STEPS.length - 1)) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Step 0: Pick restaurant ─────────────────────────── */}
      {step === 0 && (
        <div className="fade-in">
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>
            Donate <span className="gradient-text">Surplus Food</span>
          </h1>
          <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>
            Found yourself with extra food tonight? Let's get it to someone who needs it — in minutes.
          </p>

          <div className="glass" style={{ padding: '1.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 8, fontWeight: 600 }}>
              WHICH RESTAURANT ARE YOU FROM?
            </label>
            <div className="input-field" style={{ marginBottom: '1.5rem' }}>
              {restaurant.name}
            </div>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setStep(1)}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Describe the surplus ────────────────────── */}
      {step === 1 && (
        <div className="fade-in">
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>
            What do you <span className="gradient-text">have tonight?</span>
          </h1>
          <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>
            Just type it out naturally — our AI will fill in the details for you.
          </p>

          <div className="glass" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 8, fontWeight: 600 }}>
              <FiMessageSquare style={{ marginRight: 6 }} /> DESCRIBE YOUR SURPLUS
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder={`e.g. "We have about 30 extra meals ready by 8 PM, mostly dal and rice"`}
              value={nlpText}
              onChange={e => setNlpText(e.target.value)}
              style={{ resize: 'none', marginBottom: '1rem' }}
            />
            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={parseText}
              disabled={nlpParsing || !nlpText.trim()}
            >
              {nlpParsing ? 'Reading your message...' : 'Continue →'}
            </button>
          </div>

          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setStep(2)}>
            Skip — I'll fill the form myself
          </button>
        </div>
      )}

      {/* ── Step 2: Confirm details ──────────────────────────── */}
      {step === 2 && (
        <div className="fade-in">
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>
            Confirm <span className="gradient-text">Details</span>
          </h1>
          <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>
            We'll automatically find the closest NGO and notify them right away.
          </p>

          <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                RESTAURANT
              </label>
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(34,197,94,0.08)', borderRadius: 10, fontWeight: 600, border: '1px solid rgba(34,197,94,0.2)' }}>
                {restaurant?.name}
              </div>
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                NUMBER OF MEALS *
              </label>
              <input
                className="input-field"
                type="number"
                min={1}
                placeholder="e.g. 30"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                FOOD TYPE
              </label>
              <input
                className="input-field"
                placeholder="e.g. Dal & Rice, Pizza, Sandwiches…"
                value={foodType}
                onChange={e => setFoodType(e.target.value)}
              />
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                READY FOR PICKUP AT
              </label>
              <input
                className="input-field"
                type="time"
                value={pickupTime}
                onChange={e => setPickupTime(e.target.value)}
              />
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                <FiMapPin style={{ marginRight: 4 }} /> PICKUP ADDRESS (optional)
              </label>
              {isLoaded ? (
                <Autocomplete
                  onLoad={ref => { autocompleteRef.current = ref }}
                  onPlaceChanged={onPlaceChanged}
                  options={{ componentRestrictions: { country: 'in' }, fields: ['geometry', 'formatted_address', 'name'] }}
                >
                  <input
                    className="input-field"
                    placeholder="Search address or landmark…"
                    value={pickupLocation}
                    onChange={e => { setPickupLocation(e.target.value); setPickupLatLng(null) }}
                  />
                </Autocomplete>
              ) : (
                <input
                  className="input-field"
                  placeholder="Type pickup address…"
                  value={pickupLocation}
                  onChange={e => setPickupLocation(e.target.value)}
                />
              )}
              {pickupLatLng && (
                <p style={{ color: '#22c55e', fontSize: '0.75rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiMapPin size={11} /> Location confirmed
                </p>
              )}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: '0.875rem', background: 'rgba(239,68,68,0.08)', padding: '0.75rem', borderRadius: 8 }}>
                <FiAlertCircle /> {error}
              </div>
            )}

            <button
              className="btn-amber"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
              onClick={submitDonation}
              disabled={submitting || !quantity}
            >
              {submitting
                ? 'Finding best NGO nearby...'
                : <><MdOutlineRestaurantMenu size={18} /> Donate &amp; Match NGO</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Success ──────────────────────────────────── */}
      {step === 3 && result && (
        <div className="fade-in" style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
            border: '2px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <FiCheckCircle color="#22c55e" size={32} />
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
            Donation <span className="gradient-text">Confirmed!</span>
          </h1>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Thank you, {restaurant?.name}. Your donation is now active.
          </p>

          {result.matched_ngo && (
            <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.75rem' }}>NGO ASSIGNED</div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>{result.matched_ngo.name}</div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 6 }}>{result.matched_ngo.address}</div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>DISTANCE</div>
                  <div style={{ color: '#22c55e', fontWeight: 700 }}>{result.matched_ngo.distance_km} km away</div>
                </div>
                {result.matched_ngo.phone && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>CONTACT</div>
                    <div style={{ fontWeight: 600 }}>{result.matched_ngo.phone}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {!result.matched_ngo && (
            <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>OPEN DONATION</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Donation posted for NGO acceptance.</div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Your donation is visible in the NGO pickup queue. Suggested NGOs are shown below.
              </div>
              {confirmedNgoName && (
                <div style={{
                  marginTop: 10, padding: '0.75rem 0.9rem',
                  borderRadius: 10, border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.12)',
                }}>
                  <div style={{ color: '#4ade80', fontWeight: 700 }}>
                    Donation confirmed at {confirmedNgoName}
                  </div>
                </div>
              )}
              {!confirmedNgoName && activeSuggestion && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>
                    SUGGESTED NGO {suggestionList.length > 1 ? `(${Math.min(suggestionIndex + 1, suggestionList.length)}/${suggestionList.length})` : ''}
                  </div>
                  <div style={{ fontWeight: 700 }}>{activeSuggestion.name}</div>
                  {activeSuggestion.address && (
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{activeSuggestion.address}</div>
                  )}
                  {(activeSuggestion.distance_text || activeSuggestion.distance_km != null) && (
                    <div style={{ color: '#22c55e', fontWeight: 700, marginTop: 4 }}>
                      {activeSuggestion.distance_text || `${activeSuggestion.distance_km} km`} away
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={skipSuggestion}
                    >
                      Skip
                    </button>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={confirmDonationAtNgo}
                      disabled={confirmingDonation}
                    >
                      {confirmingDonation ? 'Confirming...' : 'Donate'}
                    </button>
                  </div>
                </div>
              )}
              {!confirmedNgoName && !activeSuggestion && (
                <div style={{ marginTop: 10, color: '#64748b', fontSize: '0.9rem' }}>
                  No more suggestions available right now. NGOs can still claim this donation from queue.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={reset}>
              <FiSend size={16} /> Donate Again
            </button>
          </div>
        </div>
      )}

      {/* Back button */}
      {step > 0 && step < 3 && (
        <button onClick={() => setStep(s => s - 1)}
          style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back
        </button>
      )}
    </div>
  )
}
