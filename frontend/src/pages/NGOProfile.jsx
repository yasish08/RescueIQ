import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleMap, OverlayView, useJsApiLoader } from '@react-google-maps/api'
import { FiCheck, FiX, FiShield, FiStar, FiEdit2, FiAlertCircle, FiRefreshCw, FiMapPin, FiNavigation } from 'react-icons/fi'
import { MdVolunteerActivism } from 'react-icons/md'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import ReviewCard from '../components/ReviewCard'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES = ['places']
const MAP_CENTER = { lat: 20.5937, lng: 78.9629 }

export default function NGOProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isLoaded: mapLoaded, loadError: mapLoadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_API_KEY,
    libraries: LIBRARIES,
  })

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

  // Location selection
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [searchingPlaces, setSearchingPlaces] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationError, setLocationError] = useState('')

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
      const lat = Number(data.ngo.latitude)
      const lng = Number(data.ngo.longitude)
      const hasValidLocation = Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)
      if (hasValidLocation) {
        setSelectedPlace({
          lat,
          lng,
          name: data.ngo.name,
          formatted_address: data.ngo.address || '',
          place_id: null,
        })
        setLocationQuery(data.ngo.address || '')
      } else {
        setSelectedPlace(null)
      }
      try {
        const r = await api.getReviews(user.id)
        setReviews(r)
      } catch {
        setReviews([])
      }
    } catch (e) {
      console.error(e)
      setLocationError('Could not load NGO profile right now. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const query = locationQuery.trim()
    if (query.length < 3) {
      setLocationSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchingPlaces(true)
      try {
        const loc = selectedPlace?.lat != null && selectedPlace?.lng != null
          ? `${selectedPlace.lat},${selectedPlace.lng}`
          : undefined
        const result = await api.placesAutocomplete(query, loc)
        setLocationSuggestions(result?.predictions || [])
      } catch {
        setLocationSuggestions([])
      }
      setSearchingPlaces(false)
    }, 350)

    return () => clearTimeout(timer)
  }, [locationQuery, selectedPlace?.lat, selectedPlace?.lng])

  async function selectPlace(prediction) {
    setLocationError('')
    try {
      const details = await api.placeDetails(prediction.place_id)
      const lat = Number(details?.lat)
      const lng = Number(details?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationError('Could not resolve selected place location. Try another result.')
        return
      }
      setSelectedPlace({
        lat,
        lng,
        name: details?.name || prediction.main_text || prediction.description,
        formatted_address: details?.formatted_address || prediction.description || '',
        place_id: prediction.place_id,
      })
      setLocationQuery(details?.formatted_address || prediction.description || '')
      setLocationSuggestions([])
    } catch {
      setLocationError('Could not fetch selected place details. Please retry.')
    }
  }

  async function selectFromMap(event) {
    const lat = Number(event?.latLng?.lat?.())
    const lng = Number(event?.latLng?.lng?.())
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    setLocationError('')
    setSelectedPlace({
      lat,
      lng,
      name: 'Pinned Location',
      formatted_address: `Pinned on map (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      place_id: null,
    })
    setLocationSuggestions([])
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported on this device/browser.')
      return
    }
    setLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude)
        const lng = Number(position.coords.longitude)
        setSelectedPlace({
          lat,
          lng,
          name: 'Current Location',
          formatted_address: profile?.address || '',
          place_id: null,
        })
        setLocationQuery(profile?.address || 'Current Location')
        setLocationSuggestions([])
        setLocating(false)
      },
      () => {
        setLocationError('Unable to fetch current location. Check location permissions and retry.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }

  async function saveNGOLocation() {
    const lat = Number(selectedPlace?.lat)
    const lng = Number(selectedPlace?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLocationError('Search and select a place (or use current location) before saving.')
      return
    }
    setLocationError('')
    setLocationSaving(true)
    try {
      await api.updateNGOProfile(user.id, {
        latitude: lat,
        longitude: lng,
        ...(selectedPlace?.formatted_address ? { address: selectedPlace.formatted_address } : {}),
      })
      setProfile(p => ({
        ...p,
        latitude: lat,
        longitude: lng,
        ...(selectedPlace?.formatted_address ? { address: selectedPlace.formatted_address } : {}),
      }))
      setForm(f => ({
        ...f,
        ...(selectedPlace?.formatted_address ? { address: selectedPlace.formatted_address } : {}),
      }))
    } catch {
      setLocationError('Could not save NGO location. Please try again.')
    }
    setLocationSaving(false)
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

      {/* NGO Location */}
      <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <FiMapPin color="#c084fc" size={18} />
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>NGO Location</h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.84rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          Search and select NGO location using Google Places, pick from map, or use current location.
        </p>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Search Place</span>
            <input
              className="input-field"
              placeholder="Search NGO location..."
              value={locationQuery}
              onChange={e => setLocationQuery(e.target.value)}
            />
          </label>
          {searchingPlaces && (
            <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 6 }}>
              Searching places…
            </div>
          )}
          {locationSuggestions.length > 0 && (
            <div style={{
              marginTop: 8,
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'rgba(2,6,23,0.65)',
            }}>
              {locationSuggestions.map((item) => (
                <button
                  key={item.place_id}
                  type="button"
                  onClick={() => selectPlace(item)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '0.6rem 0.75rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(148,163,184,0.15)',
                    fontSize: '0.83rem',
                  }}
                >
                  {item.description}
                </button>
              ))}
            </div>
          )}
          {selectedPlace && (
            <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 8 }}>
              Selected: {selectedPlace.formatted_address || selectedPlace.name}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={useCurrentLocation} disabled={locating}>
            <FiNavigation size={14} /> {locating ? 'Locating…' : 'Use Current Location'}
          </button>
          <button className="btn-secondary" onClick={() => setShowMapPicker(v => !v)}>
            <FiMapPin size={14} /> {showMapPicker ? 'Hide Map Picker' : 'Choose From Map'}
          </button>
          <button className="btn-primary" onClick={saveNGOLocation} disabled={locationSaving}
            style={{ background: 'linear-gradient(135deg,#c084fc,#a855f7)' }}>
            <FiMapPin size={14} /> {locationSaving ? 'Saving…' : 'Save NGO Location'}
          </button>
        </div>

        {showMapPicker && (
          <div style={{ marginTop: '0.9rem' }}>
            {!GOOGLE_API_KEY ? (
              <div style={{ color: '#f59e0b', fontSize: '0.82rem' }}>
                Map picker needs `VITE_GOOGLE_MAPS_API_KEY`.
              </div>
            ) : mapLoadError ? (
              <div style={{ color: '#f87171', fontSize: '0.82rem' }}>
                Could not load map picker right now.
              </div>
            ) : !mapLoaded ? (
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Loading map…</div>
            ) : (
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.25)' }}>
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: 260 }}
                  center={selectedPlace?.lat != null && selectedPlace?.lng != null
                    ? { lat: Number(selectedPlace.lat), lng: Number(selectedPlace.lng) }
                    : MAP_CENTER}
                  zoom={selectedPlace?.lat != null && selectedPlace?.lng != null ? 14 : 5}
                  onClick={selectFromMap}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                  }}
                >
                  {selectedPlace?.lat != null && selectedPlace?.lng != null && (
                    <OverlayView
                      position={{ lat: Number(selectedPlace.lat), lng: Number(selectedPlace.lng) }}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#c084fc',
                          border: '2px solid #ffffff',
                          boxShadow: '0 0 0 4px rgba(192,132,252,0.2)',
                          transform: 'translate(-9px, -9px)',
                        }}
                      />
                    </OverlayView>
                  )}
                </GoogleMap>
              </div>
            )}
            <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 6 }}>
              Tap on the map to pin your NGO location.
            </div>
          </div>
        )}

        {locationError && (
          <div style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '0.7rem' }}>
            {locationError}
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
