import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import MapSearch from './pages/MapSearch'
import UserDashboard from './pages/UserDashboard'
import ProviderRegister from './pages/ProviderRegister'
import ProviderDashboard from './pages/ProviderDashboard'
import AdminDashboard from './pages/AdminDashboard'

function roleHome(role) {
  if (role === 'admin') return '/admin'
  if (role === 'provider') return '/provider/dashboard'
  return '/'
}

function ProtectedRoute({ children, allowed }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (allowed && !allowed.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />
  return children
}

function NavLink({ to, children, active }) {
  return (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        active
          ? 'text-green-400 border-b-2 border-green-400 pb-0.5'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) return null

  const path = location.pathname
  const tab = new URLSearchParams(location.search).get('tab') || ''

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleColor = user.role === 'admin'
    ? 'bg-purple-700 text-purple-200'
    : user.role === 'provider'
    ? 'bg-blue-700 text-blue-200'
    : 'bg-green-800 text-green-200'

  return (
    <nav className="bg-gray-900 text-white px-6 h-14 flex items-center gap-6">
      <span className="font-bold text-lg text-green-400 mr-2">⚡ saasPlug</span>

      {user.role === 'user' && (
        <>
          <NavLink to="/" active={path === '/'}>Χάρτης</NavLink>
          <NavLink to="/user" active={path === '/user'}>Κρατήσεις μου</NavLink>
        </>
      )}

      {user.role === 'provider' && (
        <>
          <NavLink to="/provider/dashboard?tab=map" active={path.startsWith('/provider') && (!tab || tab === 'map')}>Χάρτης</NavLink>
          <NavLink to="/provider/dashboard?tab=stats" active={tab === 'stats'}>Στατιστικά</NavLink>
          <NavLink to="/provider/dashboard?tab=invoices" active={tab === 'invoices'}>Invoices</NavLink>
          <NavLink to="/provider/dashboard?tab=reservations" active={tab === 'reservations'}>Κρατήσεις</NavLink>
        </>
      )}

      {user.role === 'admin' && (
        <>
          <NavLink to="/admin" active={path === '/admin' && !tab}>Χάρτης</NavLink>
          <NavLink to="/admin?tab=Στατιστικά" active={tab === 'Στατιστικά'}>Στατιστικά</NavLink>
          <NavLink to="/admin?tab=Υγεία" active={tab === 'Υγεία'}>Υγεία</NavLink>
          <NavLink to="/admin?tab=Πάροχοι" active={tab === 'Πάροχοι'}>Πάροχοι</NavLink>
          <NavLink to="/admin?tab=Κρατήσεις" active={tab === 'Κρατήσεις'}>Κρατήσεις</NavLink>
          <NavLink to="/provider/register" active={path === '/provider/register'}>Νέος Πάροχος</NavLink>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${roleColor}`}>
          {user.name}
        </span>
        <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition-colors">
          Αποσυνδεση
        </button>
      </div>
    </nav>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        <Route path="/" element={
          <ProtectedRoute allowed={['user']}>
            <MapSearch />
          </ProtectedRoute>
        } />
        <Route path="/user" element={
          <ProtectedRoute allowed={['user']}>
            <UserDashboard />
          </ProtectedRoute>
        } />

        <Route path="/provider/dashboard" element={
          <ProtectedRoute allowed={['provider', 'admin']}>
            <ProviderDashboard />
          </ProtectedRoute>
        } />
        <Route path="/provider/register" element={
          <ProtectedRoute allowed={['provider', 'admin']}>
            <ProviderRegister />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute allowed={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
