import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const decodeHtml = (str) => str?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') || ''

export default function UserDashboard() {
  const { user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCancelled, setShowCancelled] = useState(false)

  const fmtDate = (s) => s && !s.startsWith('1970')
    ? new Date(s + 'Z').toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const handleCancel = async (resId) => {
    if (!confirm('Ακυρωση κρατησης;')) return
    try {
      await axios.put(`/api/orchestrator/admin/reservations/${resId}/cancel`)
      setReservations(prev => prev.map(r => r.id === resId ? { ...r, status: 'CANCELLED' } : r))
    } catch { alert('Σφαλμα ακυρωσης') }
  }

  const fetchData = async () => {
    setLoading(true)
    const [resRes, searchRes] = await Promise.allSettled([
      axios.get(`/api/orchestrator/reservations/user/${user?.name}`),
      axios.get('/api/orchestrator/search'),
    ])
    if (resRes.status === 'fulfilled') setReservations(resRes.value.data?.reservations || [])
    if (searchRes.status === 'fulfilled') setPoints(searchRes.value.data || [])
    setLoading(false)
  }

  useEffect(() => { if (user?.name) fetchData() }, [user?.name])

  const active = reservations.filter(r => r.status === 'ACTIVE' && !(new Date(r.endTime + 'Z') < new Date()))
  const inactive = reservations.filter(r => r.status === 'CANCELLED' || new Date(r.endTime + 'Z') < new Date())

  const visible = reservations.filter(r => {
    const expired = r.status === 'ACTIVE' && new Date(r.endTime + 'Z') < new Date()
    if (expired || r.status === 'CANCELLED') return showCancelled
    return true
  })

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Κρατήσεις μου</h1>
          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">{active.length} ενεργες</span>
          {inactive.length > 0 && (
            <button onClick={() => setShowCancelled(v => !v)}
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border transition-colors ${showCancelled ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
              {showCancelled ? 'Κρυψε' : `+ ${inactive.length} ακυρωμενες/ληγμενες`}
            </button>
          )}
        </div>
        <button onClick={fetchData} disabled={loading} className="text-xs text-gray-400 hover:text-gray-700 font-bold disabled:opacity-40">
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Φορτωση...</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 border-2 border-dashed rounded-xl">
          <p className="text-lg font-medium">Δεν υπάρχουν κρατήσεις</p>
          <p className="text-sm mt-1">Πήγαινε στον <Link to="/" className="text-blue-500 underline">Χάρτη</Link> για να κάνεις κράτηση</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(r => {
            const pt = points.find(p => String(p.pointId) === String(r.pointId))
            const expired = r.status === 'ACTIVE' && new Date(r.endTime + 'Z') < new Date()
            const isActive = r.status === 'ACTIVE' && !expired
            return (
              <div key={r.id} className={`bg-white border rounded-xl p-4 ${!isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {pt?.providerName && (
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{pt.providerName}</span>
                      )}
                      <span className="font-semibold text-gray-900">{pt?.locationName || `Point ${r.pointId}`}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {expired ? 'ΛΗΓΜΕΝΗ' : r.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 text-xs text-gray-500">
                      {pt?.address && <span className="col-span-2 mb-1 text-gray-600">{decodeHtml(pt.address)}</span>}
                      <span>Εναρξη: <strong className="text-gray-700">{fmtDate(r.startTime)}</strong></span>
                      <span>Ληξη: <strong className="text-gray-700">{fmtDate(r.endTime)}</strong></span>
                      {pt?.pricePerKwh && <span>Τιμη: <strong className="text-gray-700">{pt.pricePerKwh} €/kWh</strong></span>}
                      {pt?.cap && <span>Ισχυς: <strong className="text-gray-700">{pt.cap} kW</strong></span>}
                      {pt?.connector && <span>Connector: <strong className="text-gray-700">{pt.connector}</strong></span>}
                    </div>
                  </div>
                  {isActive && (
                    <button onClick={() => handleCancel(r.id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 self-start mt-1">
                      Ακυρωση
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
