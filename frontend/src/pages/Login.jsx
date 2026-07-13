import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Συμπλήρωσε username και password')
      return
    }
    const role = login(username, password)
    if (role === 'admin') navigate('/admin')
    else if (role === 'provider') navigate('/provider/dashboard')
    else navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl p-10 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-8">
          <span className="text-4xl">⚡</span>
          <h1 className="text-2xl font-bold text-white mt-2">saasPlug</h1>
          <p className="text-gray-400 text-sm mt-1">Σύνδεση στην πλατφόρμα</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="π.χ. admin, blue plug, john"
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="••••••••"
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-400"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Σύνδεση
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-600 space-y-1">
          <p>Admin: <span className="text-gray-400">admin / admin</span></p>
          <p>Πάροχος: <span className="text-gray-400">blue plug / blue plug</span></p>
          <p>Χρήστης: <span className="text-gray-400">οποιοσδήποτε / οποιοσδήποτε</span></p>
        </div>
      </div>
    </div>
  )
}
