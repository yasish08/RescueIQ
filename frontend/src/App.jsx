import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import PredictDonate from './pages/PredictDonate'
import NGOView from './pages/NGOView'
import NGORequest from './pages/NGORequest'
import MapView from './pages/MapView'
import ImpactDashboard from './pages/ImpactDashboard'
import LoginPage from './pages/LoginPage'
import RestaurantProfile from './pages/RestaurantProfile'
import NGOProfile from './pages/NGOProfile'
import './index.css'

function AppRoutes() {
  const { user, loading } = useAuth()
  const isDonor = user?.role === 'restaurant' || user?.role === 'provider'

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🥘</div>
          <div>Loading RescueIQ…</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <>
      <Navbar />
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + var(--top-bar-height))' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/predict" element={isDonor ? <PredictDonate /> : <Navigate to="/request" replace />} />
          <Route path="/request" element={user.role === 'ngo' ? <NGORequest /> : <Navigate to="/predict" replace />} />
          <Route path="/ngo" element={user.role === 'ngo' ? <NGOView /> : <Navigate to="/" replace />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/impact" element={<ImpactDashboard />} />
          <Route path="/profile" element={
            user.role === 'ngo' ? <NGOProfile /> : isDonor ? <RestaurantProfile /> : <Navigate to="/" replace />
          } />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
