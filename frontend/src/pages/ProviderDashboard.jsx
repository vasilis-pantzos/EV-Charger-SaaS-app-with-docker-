import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import PointPanel from '../components/PointPanel'
import { markerIcon } from '../components/markerIcon'
import { useProviders } from '../context/useProviders'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function ProviderDashboard() {
  const { user } = useAuth()
  const providerName = user?.name || ''
  // "blue plug" → "bluePlug" για τα API calls
  const providerKey = providerName.replace(/\s+(.)/g, (_, c) => c.toUpperCase()).replace(/^\s+/, '')
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'map'

  const { getProviderInfo } = useProviders()
  const [stats, setStats] = useState(null)
  const [allPoints, setAllPoints] = useState([])
  const [invoices, setInvoices] = useState([])
  const [reservations, setReservations] = useState([])
  const [selected, setSelected] = useState(null)
  const [showCancelled, setShowCancelled] = useState(false)

  const normalize = s => s?.toLowerCase().replace(/\s+/g, '')
  const points = allPoints.filter(p => normalize(p.providerName) === normalize(providerName))

  const fmtDate = (s) => s && !s.startsWith('1970')
    ? new Date(s + 'Z').toLocaleString('el-GR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '—'

  useEffect(() => {
    if (!providerName) return
    fetchAll()
  }, [providerName])

  const fetchAll = async () => {
    const [statsRes, searchRes, invRes, resRes] = await Promise.allSettled([
      axios.get(`/api/orchestrator/statistics/provider/${providerKey}/detailed`),
      axios.get('/api/orchestrator/search'),
      axios.get(`/api/orchestrator/invoices/provider/${providerKey}`),
      axios.get('/api/orchestrator/admin/reservations'),
    ])
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
    if (searchRes.status === 'fulfilled') setAllPoints(searchRes.value.data || [])
    if (invRes.status === 'fulfilled') setInvoices(invRes.value.data?.invoices || invRes.value.data || [])
    if (resRes.status === 'fulfilled') setReservations(resRes.value.data?.reservations || [])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {tab === 'map' && (
        <div className="flex-1">
          {points.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-5xl mb-3">📍</p>
                <p className="text-lg">Δεν βρέθηκαν σημεία για τον πάροχο <strong>{providerName}</strong></p>
              </div>
            </div>
          ) : (
            <div className="flex h-full">
              <div className="flex-1">
                <MapContainer
                  center={[parseFloat(points[0]?.lat) || 37.98, parseFloat(points[0]?.lon) || 23.73]}
                  zoom={12}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {points.map((p, i) => (
                    <Marker
                      key={i}
                      position={[parseFloat(p.lat) || 37.98, parseFloat(p.lon) || 23.73]}
                      icon={markerIcon(p.providerName)}
                      eventHandlers={{ click: () => { setSelected(p); axios.post('/api/orchestrator/click', { provider: p.providerName, pointId: p.pointId }).catch(() => {}) } }}
                    />
                  ))}
                </MapContainer>
              </div>
              {/* Info Panel */}
              <div className="w-80 bg-white border-l shadow-lg flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{providerName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{points.length}</span>
                      <button onClick={fetchAll} className="text-xs text-gray-400 hover:text-gray-600 font-bold">↻</button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Κρατήσεις</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">Live</span>
                  </div>
                </div>
                <PointPanel
                  point={selected}
                  providerInfo={selected ? getProviderInfo(selected.providerName) : null}
                  onClose={() => setSelected(null)}
                  showReserve={false}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {!stats ? (
              <p className="text-gray-400 text-sm">Φόρτωση...</p>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-xl p-5 text-center">
                    <p className="text-3xl font-bold text-blue-600">{stats.summary?.Click || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Clicks</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-5 text-center">
                    <p className="text-3xl font-bold text-green-600">{stats.summary?.Reservation || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Κρατήσεις</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-5 text-center">
                    <p className="text-3xl font-bold text-gray-700">{stats.total_events || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Συνολικά events</p>
                  </div>
                </div>

                {/* Σημεια παροχου */}
                <div className="bg-white border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Κατάσταση σημείων (live)</h3>
                    <span className="text-xs text-gray-400">{points.length} σύνολο</span>
                  </div>
                  {(() => {
                    const STATUS_MAP = {
                      available:   { label: 'Διαθέσιμα', color: 'text-green-600' },
                      reserved:    { label: 'Κρατημένα', color: 'text-amber-500' },
                      held:        { label: 'Κρατημένα', color: 'text-amber-500' },
                      malfunction: { label: 'Βλάβη',     color: 'text-red-500'   },
                      offline:     { label: 'Offline',   color: 'text-gray-400'  },
                      charging:    { label: 'Φορτίζει',  color: 'text-blue-500'  },
                    }
                    const counts = points.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc }, {})
                    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
                    const cols = entries.length <= 3 ? entries.length : entries.length <= 4 ? 4 : 3
                    return (
                      <div className={`grid grid-cols-${cols} gap-px bg-gray-100 rounded-lg overflow-hidden`}>
                        {entries.map(([status, count]) => {
                          const { label, color } = STATUS_MAP[status] || { label: status, color: 'text-gray-500' }
                          return (
                            <div key={status} className="bg-white p-4 text-center">
                              <p className={`text-2xl font-bold ${color}`}>{count}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-500">Κρατήσεις μέσω saasPlug</span>
                    <span className="text-sm font-bold text-blue-600">
                      {reservations.filter(r => r.status === 'ACTIVE' && points.some(p => String(p.pointId) === String(r.pointId))).length}
                    </span>
                  </div>
                </div>

                {/* Ημερήσια δραστηριότητα */}
                {stats.daily_breakdown?.length > 0 && (
                  <div className="bg-white border rounded-xl p-5">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ημερήσια δραστηριότητα</h3>
                    <div className="space-y-2">
                      {stats.daily_breakdown.map(({ day, count }) => {
                        const max = Math.max(...stats.daily_breakdown.map(d => d.count))
                        return (
                          <div key={day} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-24 flex-shrink-0">{day}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="h-2 rounded-full bg-gray-700" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-600 w-6 text-right">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-6">Invoices — {providerName}</h2>
            {invoices.length === 0 ? (
              <p className="text-gray-400">Δεν υπάρχουν invoices</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv, i) => (
                  <div key={i} className="bg-white border rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">Invoice #{inv.invoice_id}</p>
                        <p className="text-sm text-gray-500">
                          {inv.billing_month}/{inv.billing_year}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-gray-900">{inv.total_amount}€</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          inv.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{inv.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 border-t pt-2">
                      <span>Σημεία: <strong className="text-gray-700">{inv.total_points}</strong></span>
                      <span>Τιμή/σημείο: <strong className="text-gray-700">{inv.price_per_point}€</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'reservations' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Κρατήσεις</h2>
                {(() => {
                  const myRes = reservations.filter(r => points.some(p => String(p.pointId) === String(r.pointId)))
                  const active = myRes.filter(r => r.status === 'ACTIVE' && !(new Date(r.endTime + 'Z') < new Date()))
                  const inactive = myRes.filter(r => r.status === 'CANCELLED' || new Date(r.endTime + 'Z') < new Date())
                  return (
                    <>
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">{active.length} ενεργές</span>
                      {inactive.length > 0 && (
                        <button onClick={() => setShowCancelled(v => !v)}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold border transition-colors ${showCancelled ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                          {showCancelled ? 'Κρύψε' : `+ ${inactive.length} ακυρωμένες/ληγμένες`}
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
              <button onClick={fetchAll} className="text-xs text-gray-400 hover:text-gray-700 font-bold">↻ Refresh</button>
            </div>

            {(() => {
              const myRes = reservations.filter(r => points.some(p => String(p.pointId) === String(r.pointId)))
              const visible = myRes.filter(r => {
                const expired = r.status === 'ACTIVE' && !r.endTime?.startsWith('1970') && new Date(r.endTime + 'Z') < new Date()
                if (expired || r.status === 'CANCELLED') return showCancelled
                return true
              })
              if (visible.length === 0) return <p className="text-gray-400 text-sm">Δεν υπάρχουν κρατήσεις.</p>
              return (
                <div className="space-y-2">
                  {visible.map(r => {
                    const pt = points.find(p => String(p.pointId) === String(r.pointId))
                    const expired = r.status === 'ACTIVE' && new Date(r.endTime + 'Z') < new Date()
                    const active = r.status === 'ACTIVE' && !expired
                    return (
                      <div key={r.id} className={`bg-white border rounded-lg p-4 ${!active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="font-semibold text-gray-900 text-sm">{pt?.locationName || `Point ${r.pointId}`}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {expired ? 'ΛΗΓΜΕΝΗ' : r.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 text-xs text-gray-500">
                          <span>Χρήστης: <strong className="text-gray-700">{r.userID}</strong></span>
                          {pt?.address && <span>Διεύθυνση: <strong className="text-gray-700">{pt.address}</strong></span>}
                          <span>Έναρξη: <strong className="text-gray-700">{fmtDate(r.startTime)}</strong></span>
                          <span>Λήξη: <strong className="text-gray-700">{fmtDate(r.endTime)}</strong></span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
