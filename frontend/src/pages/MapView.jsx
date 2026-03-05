import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  GoogleMap, useJsApiLoader, Marker, InfoWindow,
  DirectionsRenderer, Circle,
} from '@react-google-maps/api'
import { FiRefreshCw, FiLayers, FiNavigation } from 'react-icons/fi'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES = ['places']

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0f1e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f1e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060d1f' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
]

const CENTER = { lat: 20.5937, lng: 78.9629 }  // India fallback
const NGO_RANGE_KM = 5

export default function MapView() {
  const { user, restaurantId } = useAuth()
  const isDonor = user?.role === 'restaurant' || user?.role === 'provider'
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_API_KEY,
    libraries: LIBRARIES,
  })

  const mapRef = useRef(null)
  const watchIdRef = useRef(null)
  const autoLocateAttemptedRef = useRef(false)
  const [pins, setPins] = useState({ restaurants: [], ngos: [], routes: [] })
  const [nearbyNgos, setNearbyNgos] = useState([])
  const [nearbyMeta, setNearbyMeta] = useState(null)
  const [selected, setSelected] = useState(null)
  const [directions, setDirections] = useState([])
  const [showRoutes, setShowRoutes] = useState(true)
  const [showRestaurants, setShowRestaurants] = useState(true)
  const [showNGOs, setShowNGOs] = useState(true)
  const [loading, setLoading] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [referenceLocation, setReferenceLocation] = useState(null)
  const [locationAccuracy, setLocationAccuracy] = useState(null)
  const [watchingLocation, setWatchingLocation] = useState(false)
  const [geoError, setGeoError] = useState('')
  const activeLocation = isDonor ? userLocation : (userLocation || referenceLocation)
  const mapCanvasHeight = 'calc(100% - (70px + env(safe-area-inset-bottom)))'
  const mapViewportHeight = 'calc(100dvh - var(--top-bar-height) - env(safe-area-inset-top))'

  const parseGeoError = useCallback((error, fallbackText) => {
    if (!error) return fallbackText
    if (error.code === 1) {
      return 'Location permission denied. Enable location permission for RescueIQ in phone settings and try again.'
    }
    if (error.code === 2) return 'Location is unavailable. Turn on GPS/network location and retry.'
    if (error.code === 3) return 'Location request timed out. Move to open sky and retry.'
    return error.message || fallbackText
  }, [])

  const haversineKm = useCallback((pointA, pointB) => {
    const toRadians = (value) => (value * Math.PI) / 180
    const earthRadiusKm = 6371
    const dLat = toRadians(pointB.lat - pointA.lat)
    const dLng = toRadians(pointB.lng - pointA.lng)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(pointA.lat)) * Math.cos(toRadians(pointB.lat)) * Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return earthRadiusKm * c
  }, [])

  const isValidCoord = useCallback((lat, lng) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false
    if (Number.isNaN(lat) || Number.isNaN(lng)) return false
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }, [])

  // Fetch real pins from backend
  const fetchPins = useCallback(async () => {
    setLoading(true)
    try {
      const [pinData, routeData] = await Promise.all([
        api.getMapPins(),
        api.getRoutes().catch(() => []),
      ])

      const acceptedRoutes = Array.isArray(routeData)
        ? routeData.map(route => ({
            origin: route.from,
            destination: route.to,
            donation_id: route.donation_id,
          }))
        : []

      if (pinData.restaurants?.length || pinData.ngos?.length) {
        setPins({ ...pinData, routes: acceptedRoutes })
      } else {
        setPins({ restaurants: [], ngos: [], routes: acceptedRoutes })
      }
    } catch {
      setPins({ restaurants: [], ngos: [], routes: [] })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPins() }, [fetchPins])

  useEffect(() => {
    if (!isDonor) return

    api.getRestaurantProfile(user.id)
      .then((data) => {
        const lat = data?.restaurant?.latitude
        const lng = data?.restaurant?.longitude
        if (isValidCoord(lat, lng)) {
          setReferenceLocation({ lat, lng })
        }
      })
      .catch(() => {})
  }, [user, isValidCoord, isDonor])

  const applyLocation = useCallback((coords) => {
    const next = { lat: coords.latitude, lng: coords.longitude }
    setUserLocation(next)
    setReferenceLocation(next)
    setLocationAccuracy(coords.accuracy ?? null)
    setGeoError('')
    if (mapRef.current) {
      mapRef.current.panTo(next)
      mapRef.current.setZoom(14)
    }
  }, [])

  const locateNow = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported on this device/browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => applyLocation(position.coords),
      (error) => setGeoError(parseGeoError(error, 'Unable to fetch current location.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [applyLocation, parseGeoError])

  useEffect(() => {
    if (autoLocateAttemptedRef.current) return
    if (!isLoaded) return
    if (userLocation) return
    autoLocateAttemptedRef.current = true
    locateNow()
  }, [isLoaded, userLocation, locateNow])

  useEffect(() => {
    if (!isDonor) {
      setNearbyNgos([])
      setNearbyMeta(null)
      return
    }

    const base = activeLocation
    if (!base) return

    const maxRadiusKm = NGO_RANGE_KM
    api.nearbyNGOs(base.lat, base.lng, 0, 10, maxRadiusKm)
      .then((result) => {
        const backendNgos = result?.ngos || []
        setNearbyNgos(backendNgos)
        setNearbyMeta({
          count: result?.count || backendNgos.length,
          searchedRadiusKm: result?.searched_radius_km || maxRadiusKm,
        })
      })
      .catch(() => {
        setNearbyNgos([])
        setNearbyMeta(null)
      })
  }, [isDonor, activeLocation])

  const stopLiveLocation = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatchingLocation(false)
  }, [])

  const startLiveLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported on this device/browser.')
      return
    }
    if (watchIdRef.current != null) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => applyLocation(position.coords),
      (error) => {
        setGeoError(parseGeoError(error, 'Live location tracking failed.'))
        stopLiveLocation()
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
    watchIdRef.current = watchId
    setWatchingLocation(true)
  }, [applyLocation, stopLiveLocation, parseGeoError])

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  const ngoSource = useMemo(() => {
    if (!isDonor) return pins.ngos || []
    const base = activeLocation
    if (!base) return []
    const merged = []
    const seen = new Set()
    const addNgo = (ngo) => {
      const lat = ngo?.lat ?? ngo?.latitude
      const lng = ngo?.lng ?? ngo?.longitude
      if (!isValidCoord(lat, lng)) return
      const key = `${(ngo?.name || '').toLowerCase()}|${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`
      if (seen.has(key)) return
      seen.add(key)
      merged.push(ngo)
    }
    ;(nearbyNgos || []).forEach(addNgo)
    ;(pins.ngos || []).forEach(addNgo)
    return merged
  }, [isDonor, nearbyNgos, pins.ngos, isValidCoord, activeLocation])

  const ngosInRange = useMemo(() => ngoSource.filter((ngo) => {
    if (!isDonor) return true
    const base = activeLocation
    if (!base) return true
    const lat = ngo.lat ?? ngo.latitude
    const lng = ngo.lng ?? ngo.longitude
    if (!isValidCoord(lat, lng)) return false
    const point = { lat, lng }
    return haversineKm(base, point) <= NGO_RANGE_KM
  }), [ngoSource, isDonor, activeLocation, isValidCoord, haversineKm])

  const restaurantsInRange = useMemo(() => {
    const base = activeLocation
    const restaurants = pins.restaurants || []
    if (!isDonor) return restaurants
    if (!base) return []

    const inRange = restaurants.filter((restaurant) => {
      const lat = restaurant.lat ?? restaurant.latitude
      const lng = restaurant.lng ?? restaurant.longitude
      if (!isValidCoord(lat, lng)) return false
      return haversineKm(base, { lat, lng }) <= NGO_RANGE_KM
    })

    if (inRange.length) return inRange
    if (restaurantId != null) {
      const ownRestaurant = restaurants.find((restaurant) => restaurant.id === restaurantId)
      if (ownRestaurant) return [ownRestaurant]
    }
    return []
  }, [
    pins.restaurants,
    isDonor,
    activeLocation,
    isValidCoord,
    haversineKm,
    restaurantId,
  ])

  const routeCandidates = useMemo(() => {
    const routes = pins.routes || []
    if (!isDonor) return routes
    const base = activeLocation
    if (!base) return []
    return routes.filter((route) => {
      const from = route?.origin || {}
      const to = route?.destination || {}
      const fromLat = from.lat ?? from.latitude
      const fromLng = from.lng ?? from.longitude
      const toLat = to.lat ?? to.latitude
      const toLng = to.lng ?? to.longitude
      if (!isValidCoord(fromLat, fromLng) || !isValidCoord(toLat, toLng)) return false
      return haversineKm(base, { lat: fromLat, lng: fromLng }) <= NGO_RANGE_KM
        || haversineKm(base, { lat: toLat, lng: toLng }) <= NGO_RANGE_KM
    })
  }, [pins.routes, isDonor, activeLocation, haversineKm, isValidCoord])

  const visibleRestaurantCoords = useMemo(() => new Set(
    (restaurantsInRange || []).map((restaurant) => {
      const lat = restaurant.lat ?? restaurant.latitude
      const lng = restaurant.lng ?? restaurant.longitude
      return `${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`
    })
  ), [restaurantsInRange])

  const visibleNgoCoords = useMemo(() => new Set(
    (ngosInRange || []).map((ngo) => {
      const lat = ngo.lat ?? ngo.latitude
      const lng = ngo.lng ?? ngo.longitude
      return `${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`
    })
  ), [ngosInRange])

  const visibleRoutes = useMemo(() => {
    return (routeCandidates || []).filter((route) => {
      const from = route?.origin || {}
      const to = route?.destination || {}
      const fromLat = from.lat ?? from.latitude
      const fromLng = from.lng ?? from.longitude
      const toLat = to.lat ?? to.latitude
      const toLng = to.lng ?? to.longitude
      if (!isValidCoord(fromLat, fromLng) || !isValidCoord(toLat, toLng)) return false
      const fromKey = `${Number(fromLat).toFixed(4)}|${Number(fromLng).toFixed(4)}`
      const toKey = `${Number(toLat).toFixed(4)}|${Number(toLng).toFixed(4)}`
      return visibleRestaurantCoords.has(fromKey) && visibleNgoCoords.has(toKey)
    })
  }, [routeCandidates, visibleRestaurantCoords, visibleNgoCoords, isValidCoord])

  // Build directions for routes
  useEffect(() => {
    if (!isLoaded || !showRoutes || !visibleRoutes.length) {
      setDirections(prev => (prev.length ? [] : prev))
      return
    }
    const service = new window.google.maps.DirectionsService()
    Promise.all(
      visibleRoutes.map(route =>
        new Promise(resolve => {
          service.route({
            origin: route.origin,
            destination: route.destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          }, (result, status) => {
            resolve(status === 'OK' ? result : null)
          })
        })
      )
    ).then(results => setDirections(results.filter(Boolean)))
  }, [isLoaded, showRoutes, visibleRoutes])

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    if (userLocation || referenceLocation) return

    const points = [
      ...(restaurantsInRange || []).map(r => ({ lat: r.lat ?? r.latitude, lng: r.lng ?? r.longitude })),
      ...(ngosInRange || []).map(n => ({ lat: n.lat ?? n.latitude, lng: n.lng ?? n.longitude })),
    ].filter(point => isValidCoord(point.lat, point.lng))

    if (!points.length) return

    const bounds = new window.google.maps.LatLngBounds()
    points.forEach(point => bounds.extend(point))
    mapRef.current.fitBounds(bounds)

    if (points.length === 1) {
      mapRef.current.setZoom(13)
    }
  }, [isLoaded, restaurantsInRange, ngosInRange, userLocation, referenceLocation, isValidCoord])


  const onLoad = useCallback(map => { mapRef.current = map }, [])

  if (!GOOGLE_API_KEY) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
        <p>Google Maps key is missing.</p>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 520, margin: '0 auto', lineHeight: 1.5 }}>
          Set <strong>VITE_GOOGLE_MAPS_API_KEY</strong> in <strong>frontend/.env</strong> and restart the frontend server.
        </div>
      </div>
    )
  }

  if (loadError) {
    const rawMessage = String(loadError?.message || '')
    const isBillingError = rawMessage.includes('BillingNotEnabledMapError')
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
        <p>{isBillingError ? 'Google Maps billing is not enabled for this API key.' : 'Failed to load Google Maps.'}</p>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
          {isBillingError
            ? 'Enable billing on the Google Cloud project linked to this key, and ensure Maps JavaScript API (and Places API if used) are enabled for the same project.'
            : 'Verify API key restrictions (HTTP referrer), enabled APIs, and billing status in Google Cloud Console.'}
        </div>
        <code style={{ display: 'block', marginTop: 10, fontSize: '0.75rem', color: '#475569' }}>{rawMessage}</code>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div style={{ height: mapViewportHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} /> Loading map…
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, height: mapViewportHeight, pointerEvents: 'none' }}>

      {/* Google Map */}
      <div style={{ height: mapCanvasHeight, pointerEvents: 'auto' }}>
        <GoogleMap
          onLoad={onLoad}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={isDonor ? (userLocation || CENTER) : (userLocation || referenceLocation || CENTER)}
          zoom={13}
          options={{
            styles: MAP_STYLE,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: { position: window.google?.maps.ControlPosition?.RIGHT_CENTER },
            gestureHandling: 'cooperative',
          }}
        >
        {/* Restaurant markers */}
        {showRestaurants && restaurantsInRange?.map(r => (
          <Marker
            key={`r-${r.id}`}
            position={{ lat: r.lat ?? r.latitude, lng: r.lng ?? r.longitude }}
            onClick={() => setSelected({ ...r, type: 'restaurant' })}
            icon={{
              url: `data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%2322c55e' opacity='0.95'/><text x='16' y='21' text-anchor='middle' font-size='14' font-family='Arial' fill='white' font-weight='700'>R</text></svg>`,
              scaledSize: new window.google.maps.Size(36, 36),
              anchor: new window.google.maps.Point(18, 18),
            }}
          />
        ))}

        {/* NGO markers */}
        {showNGOs && ngosInRange.map(n => (
          <Marker
            key={`n-${n.id}`}
            position={{ lat: n.lat ?? n.latitude, lng: n.lng ?? n.longitude }}
            onClick={() => setSelected({ ...n, type: 'ngo' })}
            icon={{
              url: `data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%23c084fc' opacity='0.95'/><text x='16' y='21' text-anchor='middle' font-size='14' font-family='Arial' fill='white' font-weight='700'>N</text></svg>`,
              scaledSize: new window.google.maps.Size(36, 36),
              anchor: new window.google.maps.Point(18, 18),
            }}
          />
        ))}

        {/* Driving routes */}
        {showRoutes && directions.map((dir, i) => (
          <DirectionsRenderer
            key={i}
            directions={dir}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#f59e0b',
                strokeOpacity: 0.85,
                strokeWeight: 4,
              },
            }}
          />
        ))}

        {/* Current user marker + accuracy circle */}
        {userLocation && (
          <>
            <Marker
              position={userLocation}
              icon={{
                url: `data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><circle cx='14' cy='14' r='11' fill='%2338bdf8' opacity='0.95'/><circle cx='14' cy='14' r='4' fill='white'/></svg>`,
                scaledSize: new window.google.maps.Size(28, 28),
                anchor: new window.google.maps.Point(14, 14),
              }}
            />
            {locationAccuracy && (
              <Circle
                center={userLocation}
                radius={locationAccuracy}
                options={{
                  strokeColor: '#38bdf8',
                  strokeOpacity: 0.35,
                  strokeWeight: 1,
                  fillColor: '#38bdf8',
                  fillOpacity: 0.12,
                }}
              />
            )}
          </>
        )}

        {/* Info window on click */}
        {selected && (
          <InfoWindow
            position={{ lat: selected.lat ?? selected.latitude, lng: selected.lng ?? selected.longitude }}
            onCloseClick={() => setSelected(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -36) }}
          >
            <div style={{ background: '#111827', padding: '0.75rem', borderRadius: 8, minWidth: 160 }}>
              <div style={{
                fontWeight: 700, marginBottom: 4,
                color: selected.type === 'restaurant' ? '#22c55e' : '#c084fc',
              }}>
                {selected.type === 'restaurant' ? 'Restaurant' : 'NGO'}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{selected.name}</div>
              {selected.meals && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{selected.meals} meals ready</div>}
              {selected.capacity && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Capacity: {selected.capacity}</div>}
            </div>
          </InfoWindow>
        )}
        </GoogleMap>
      </div>

      {/* Layer controls */}
      <div style={{
        position: 'absolute', top: '1rem', left: '1rem',
        background: 'rgba(10,15,30,0.92)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '0.75rem', backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto',
      }}>
        <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, marginBottom: 2 }}>
          <FiLayers size={12} style={{ marginRight: 4 }} />LAYERS
        </div>
        {[
          { label: 'Restaurants', active: showRestaurants, toggle: () => setShowRestaurants(v => !v), color: '#22c55e' },
          { label: 'NGOs', active: showNGOs, toggle: () => setShowNGOs(v => !v), color: '#c084fc' },
          { label: 'Routes', active: showRoutes, toggle: () => setShowRoutes(v => !v), color: '#f59e0b' },
        ].map(({ label, active, toggle, color }) => (
          <button key={label} onClick={toggle} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: active ? `${color}22` : 'transparent',
            border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
            color: active ? color : '#475569', fontSize: '0.78rem', fontWeight: 600,
            transition: 'all 0.2s',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? color : '#1e293b', display: 'inline-block' }} />
            {label}
          </button>
        ))}
        <button onClick={fetchPins} style={{
          marginTop: 4, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#475569',
          fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
        }}>
          <FiRefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
        <button onClick={locateNow} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#38bdf8',
          fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
        }}>
          <FiNavigation size={12} />
          My Location
        </button>
        <button onClick={watchingLocation ? stopLiveLocation : startLiveLocation} style={{
          background: watchingLocation ? 'rgba(56,189,248,0.15)' : 'transparent',
          border: `1px solid ${watchingLocation ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: watchingLocation ? '#38bdf8' : '#475569',
          fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
        }}>
          <FiNavigation size={12} />
          {watchingLocation ? 'Stop Live' : 'Start Live'}
        </button>
        {geoError && (
          <div style={{ color: '#f87171', fontSize: '0.72rem', lineHeight: 1.4, maxWidth: 190 }}>
            {geoError}
          </div>
        )}
        {isDonor && !(userLocation || referenceLocation) && !geoError && (
          <div style={{ color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.4, maxWidth: 190 }}>
            Allow location to view nearby NGOs within 5 km.
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '5.5rem', right: '1rem',
        background: 'rgba(10,15,30,0.92)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '0.75rem 1rem', backdropFilter: 'blur(12px)',
        fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'auto',
      }}>
        <div style={{ color: '#22c55e', fontWeight: 600 }}>Restaurant (donating)</div>
        <div style={{ color: '#c084fc', fontWeight: 600 }}>NGO (within {NGO_RANGE_KM} km)</div>
        <div style={{ color: '#f59e0b', fontWeight: 600 }}>Accepted order route</div>
        {isDonor && nearbyMeta && (
          <div style={{ color: '#94a3b8' }}>
            Nearby NGOs found: {nearbyMeta.count} (searched up to {nearbyMeta.searchedRadiusKm} km)
          </div>
        )}
      </div>
    </div>
  )
}

