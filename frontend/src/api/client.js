import axios from 'axios'
import { Capacitor } from '@capacitor/core'

const trimSlash = (s) => s.replace(/\/$/, '')
const normalizeBase = (value) => {
  if (!value) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return trimSlash(raw)
  return trimSlash(`http://${raw}:8000`)
}

const unique = (arr) => [...new Set(arr.filter(Boolean))]

/**
 * Resolve the backend base URL so it works everywhere:
 *
 * Browser (web, localhost):
 *   → always http://localhost:8000
 *
 * Native Android/iOS — production APK:
 *   1. VITE_API_BASE_URL if set and non-localhost
 *   2. VITE_API_HOST env var (LAN IP baked at build time)
 *   3. window.location.hostname — the IP the WebView was loaded from
 *   4. Last resort: 10.0.2.2 (Android emulator alias for host loopback)
 */
function resolveCandidateBaseURLs() {
  const envBaseURL = import.meta.env.VITE_API_BASE_URL   // e.g. http://localhost:8000
  const envHost    = import.meta.env.VITE_API_HOST        // e.g. 10.194.216.236
  const envHosts   = import.meta.env.VITE_API_HOSTS       // e.g. 10.194.216.236,192.168.1.24

  // ── Browser / web ───────────────────────────────────
  if (!Capacitor.isNativePlatform()) {
    return [trimSlash(envBaseURL || 'http://localhost:8000')]
  }

  // ── Native app ──────────────────────────────────────
  const candidates = []

  // 1. Explicit full URL (non-localhost)
  if (envBaseURL && !envBaseURL.includes('localhost')) {
    candidates.push(trimSlash(envBaseURL))
  }

  // 2. Env host var (LAN IP baked at build time)
  if (envHost && envHost !== 'localhost') {
    candidates.push(normalizeBase(envHost))
  }

  // 2b. Optional multiple fallback hosts
  if (envHosts) {
    String(envHosts)
      .split(',')
      .map(normalizeBase)
      .forEach((url) => {
        if (url) candidates.push(url)
      })
  }

  // 3. Runtime: derive from the hostname the WebView was loaded from.
  //    Capacitor serves assets via a local bridge so hostname is typically
  //    'localhost' inside the WebView — but during live-reload it's the PC IP.
  const wlh = typeof window !== 'undefined' ? window.location.hostname : ''
  if (wlh && wlh !== 'localhost' && wlh !== '127.0.0.1') {
    candidates.push(`http://${wlh}:8000`)
  }

  // 4. Android emulator alias for the host machine loopback
  candidates.push('http://10.0.2.2:8000')

  // 5. Last fallback for local bridge scenarios
  candidates.push('http://localhost:8000')

  return unique(candidates)
}

const BASE_URL_CANDIDATES = resolveCandidateBaseURLs()
let ACTIVE_BASE_URL = BASE_URL_CANDIDATES[0] || 'http://localhost:8000'
let probePromise = null

async function chooseReachableBaseURL() {
  if (!Capacitor.isNativePlatform()) return ACTIVE_BASE_URL
  if (probePromise) return probePromise

  probePromise = (async () => {
    for (const base of BASE_URL_CANDIDATES) {
      try {
        const response = await axios.get(`${base}/health`, {
          timeout: 2500,
          validateStatus: () => true,
        })
        if (response.status >= 200 && response.status < 500) {
          ACTIVE_BASE_URL = base
          return base
        }
      } catch {
        // try next candidate
      }
    }
    return ACTIVE_BASE_URL
  })()

  try {
    return await probePromise
  } finally {
    probePromise = null
  }
}

const client = axios.create({
  baseURL: ACTIVE_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

console.log(`[RescueIQ] API candidates → ${BASE_URL_CANDIDATES.join(', ')}  (native: ${Capacitor.isNativePlatform()})`)

if (Capacitor.isNativePlatform()) {
  chooseReachableBaseURL().then((selected) => {
    console.log(`[RescueIQ] API selected → ${selected}`)
  })
}

// ─── Auth header interceptor ─────────────────────────
client.interceptors.request.use(async config => {
  if (Capacitor.isNativePlatform()) {
    await chooseReachableBaseURL()
    config.baseURL = ACTIVE_BASE_URL
  }
  const token = localStorage.getItem('riq_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  response => response,
  async (error) => {
    const isNative = Capacitor.isNativePlatform()
    const isNetworkError = !error?.response
    const originalRequest = error?.config || {}
    if (!isNative || !isNetworkError || originalRequest._riqRetried) {
      return Promise.reject(error)
    }

    const attempted = new Set(originalRequest._riqAttemptedBases || [])
    attempted.add(originalRequest.baseURL || ACTIVE_BASE_URL)
    const fallback = BASE_URL_CANDIDATES.find(base => !attempted.has(base))
    if (!fallback) {
      return Promise.reject(error)
    }

    ACTIVE_BASE_URL = fallback
    originalRequest.baseURL = fallback
    originalRequest._riqRetried = true
    originalRequest._riqAttemptedBases = [...attempted, fallback]
    return client.request(originalRequest)
  }
)

// ─── API helpers ─────────────────────────────────────
export const api = {
  // Auth
  login: (email, password) => client.post('/auth/login', { email, password }).then(r => r.data),
  register: (email, password, name, role, phone) =>
    client.post('/auth/register', { email, password, name, role, phone }).then(r => r.data),
  getMe: () => client.get('/auth/me').then(r => r.data),

  // Predictions
  predict: (data) => client.post('/predict', data).then(r => r.data),
  predictAll: (params = {}) => client.get('/predict/all', { params }).then(r => r.data),

  // Donations
  getDonations: (params = {}) => client.get('/donations', { params }).then(r => r.data),
  getDonation: (id) => client.get(`/donations/${id}`).then(r => r.data),
  createDonation: (data) => client.post('/donations', data).then(r => r.data),
  updateDonation: (id, data) => client.patch(`/donations/${id}`, data).then(r => r.data),

  // NGOs
  getNGOs: () => client.get('/ngos').then(r => r.data),
  matchNGO: (data) => client.post('/ngos/match', data).then(r => r.data),

  // NLP
  parseText: (text) => client.post('/nlp/parse', { text }).then(r => r.data),

  // Impact
  getImpact: () => client.get('/impact').then(r => r.data),
  getTimeline: () => client.get('/impact/timeline').then(r => r.data),

  // Map
  getMapPins: () => client.get('/map/pins').then(r => r.data),
  getRoutes: () => client.get('/map/routes').then(r => r.data),

  // Geocoding & Places
  geocodeAddress: (address) => client.post('/geocode/address', { address }).then(r => r.data),
  placesAutocomplete: (query, location) => client.post('/geocode/autocomplete', { query, location }).then(r => r.data),
  placeDetails: (place_id) => client.post('/geocode/place', { place_id }).then(r => r.data),
  drivingDistance: (origin_lat, origin_lng, dest_lat, dest_lng) =>
    client.post('/geocode/distance', { origin_lat, origin_lng, dest_lat, dest_lng }).then(r => r.data),
  nearbyNGOs: (lat, lng, target_count = 0, step_km = 10, max_radius_km = 100) =>
    client.post('/geocode/nearby-ngos', { lat, lng, target_count, step_km, max_radius_km }).then(r => r.data),

  // Profile
  getRestaurantProfile: (userId) => client.get(`/profile/restaurant/${userId}`).then(r => r.data),
  updateRestaurantProfile: (userId, data) => client.patch(`/profile/restaurant/${userId}`, data).then(r => r.data),
  getNGOProfile: (userId) => client.get(`/profile/ngo/${userId}`).then(r => r.data),
  updateNGOProfile: (userId, data) => client.patch(`/profile/ngo/${userId}`, data).then(r => r.data),
  verifyGSTIN: (gstin) => client.post('/profile/verify-gstin', { gstin }).then(r => r.data),
  verifyCertificate: (certificate_number) => client.post('/profile/verify-certificate', { certificate_number }).then(r => r.data),

  // Reviews
  getReviews: (userId) => client.get('/reviews', { params: { user_id: userId } }).then(r => r.data),
  createReview: (data) => client.post('/reviews', data).then(r => r.data),
}

export default client
