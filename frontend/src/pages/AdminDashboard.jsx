import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import axios from 'axios'
import PointPanel from '../components/PointPanel'
import { markerIcon, getColor } from '../components/markerIcon'
import { useProviders } from '../context/useProviders'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SERVICES = [
  { key: 'orchestrator',    label: 'Orchestrator'},
  { key: 'provider_stats',  label: 'Provider Stats'},
  { key: 'registration',    label: 'Registration'},
  { key: 'reservation',     label: 'Reservation'},
  { key: 'statistics',      label: 'Statistics'},
  { key: 'invoice',         label: 'Invoice'},
  { key: 'search',          label: 'Search'},
]

async function fetchHealthStatus() {
  try {
    const healthRes = await axios.get('/health');
    const h = healthRes.data;

    return {
      orchestrator:   h.orchestrator   || 'DOWN',
      reservation:    h.reservation    || 'DOWN',
      search:         h.search         || 'DOWN',
      registration:   h.registration   || 'DOWN',
      provider_stats: h.provider_stats || 'DOWN',
      statistics:     h.statistics     || 'DOWN',
      invoice:        h.invoice        || 'DOWN',
      pending_retry_events: h.pending_retry_events ?? null,
    }
  } catch (error) {
    // If the orchestrator itself is dead, everything is unreachable
    return {
      orchestrator: 'DOWN',
      reservation: 'DOWN',
      search: 'DOWN',
      registration: 'DOWN',
      provider_stats: 'DOWN',
      statistics: 'DOWN',
      invoice: 'DOWN',
      pending_retry_events: null,
    };
  }
}

export default function AdminDashboard() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'Χάρτης'
  const { getProviderInfo } = useProviders()
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [providers, setProviders] = useState([])
  const [points, setPoints] = useState([])
  const [selected, setSelected] = useState(null)
  const [reservations, setReservations] = useState([])
  const [resLoading, setResLoading] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [globalStats, setGlobalStats] = useState(null)

  const refreshHealth = async () => {
    setHealthLoading(true)
    const status = await fetchHealthStatus()
    setHealth(status)
    setHealthLoading(false)
  }

  const fetchReservations = async () => {
    setResLoading(true)
    try {
      const res = await axios.get('/api/orchestrator/admin/reservations')
      setReservations(res.data?.reservations || [])
    } catch {}
    setResLoading(false)
  }

  const handleCancelReservation = async (id) => {
    if (!confirm('Ακύρωση κράτησης;')) return
    try {
      await axios.put(`/api/orchestrator/admin/reservations/${id}/cancel`)
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r))
    } catch {
      alert('Σφάλμα ακύρωσης')
    }
  }

  useEffect(() => {
    refreshHealth()
    axios.get('/api/orchestrator/providers').then(r => setProviders(r.data?.providers || [])).catch(() => {})
    axios.get('/api/orchestrator/search').then(r => setPoints(r.data || [])).catch(() => {})
    fetchReservations()
    axios.get('/api/orchestrator/statistics/global').then(r => setGlobalStats(r.data)).catch(() => {})
  }, [])

  const handleReserve = async (p) => {
    try {
      const res = await axios.post('/api/orchestrator/reserve', {
        pointId: p.pointId,
        userId: 'admin',
        provider: p.providerName,
        duration: 60
      })
      if (res.data.success) {
        alert(`Κράτηση επιτυχής! Λήξη: ${res.data.endTime}`)
        setSelected(prev => prev ? { ...prev, status: 'reserved' } : prev)
      } else {
        alert(`Αποτυχία: ${res.data.errorMessage}`)
      }
    } catch {
      alert('Σφάλμα κράτησης')
    }
  }

  const handleDeleteProvider = async (name) => {
    if (!confirm(`Διαγραφή παρόχου "${name}";`)) return
    try {
      await axios.delete(`/api/orchestrator/providers/${name}`)
      setProviders(prev => prev.filter(p => p.providerName !== name))
    } catch { alert('Σφάλμα διαγραφής') }
  }

  // all statuses per provider from live search data
  const providerStats = points.reduce((acc, p) => {
    const n = p.providerName
    if (!acc[n]) acc[n] = { total: 0, statuses: {} }
    acc[n].total++
    acc[n].statuses[p.status] = (acc[n].statuses[p.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Χάρτης */}
      {tab === 'Χάρτης' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1">
            <MapContainer center={[37.98, 23.73]} zoom={11} className="h-full w-full">
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {points.map((p, i) => (
                <Marker key={i}
                  position={[parseFloat(p.lat) || 37.98, parseFloat(p.lon) || 23.73]}
                  icon={markerIcon(p.providerName)}
                  eventHandlers={{ click: () => { setSelected(p); axios.post('/api/orchestrator/click', { provider: p.providerName, pointId: p.pointId }).catch(() => {}) } }}
                />
              ))}
            </MapContainer>
          </div>
          <div className="w-80 bg-white border-l shadow-lg flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Όλα τα σημεία</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{points.length}</span>
                  <button onClick={() => axios.get('/api/orchestrator/search').then(r => setPoints(r.data || [])).catch(() => {})}
                    className="text-xs text-gray-400 hover:text-gray-600 font-bold">↻</button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Κρατήσεις</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">Live</span>
              </div>
            </div>
            {/* Legend */}
            <div className="px-5 py-3 border-b flex gap-4">
              {Object.entries(providerStats).map(([name, s]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getColor(name) }} />
                  <span className="text-xs font-medium text-gray-600">{name} ({s.total})</span>
                </div>
              ))}
            </div>
            <PointPanel point={selected} providerInfo={selected ? getProviderInfo(selected.providerName) : null} onClose={() => setSelected(null)} onReserve={handleReserve} showReserve={true} />
          </div>
        </div>
      )}

      {/* Στατιστικά */}
      {tab === 'Στατιστικά' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {!globalStats ? (
              <p className="text-gray-400 text-sm">Φόρτωση...</p>
            ) : (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Συνολικές Αναζητήσεις', value: globalStats.by_event_type?.find(e => e.event_type === 'SEARCH_PERFORMED')?.count ?? 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Κρατήσεις', value: globalStats.total_reservations ?? 0, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Ακυρώσεις', value: globalStats.by_event_type?.find(e => e.event_type === 'RESERVATION_CANCELLED')?.count ?? 0, color: 'text-red-500', bg: 'bg-red-50' },
                    { label: 'Clicks', value: globalStats.by_event_type?.find(e => e.event_type === 'CLICK')?.count ?? 0, color: 'text-purple-600', bg: 'bg-purple-50' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-5 text-center`}>
                      <p className={`text-3xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Ανα παροχο */}
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Κρατήσεις ανά Πάροχο</h3>
                  <div className="space-y-3">
                    {globalStats.by_provider?.map(({ provider_name, count }) => {
                      const max = Math.max(...(globalStats.by_provider?.map(p => p.count) || [1]))
                      return (
                        <div key={provider_name} className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getColor(provider_name) }} />
                          <span className="text-sm font-medium text-gray-700 w-24">{provider_name}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${(count / max) * 100}%`, background: getColor(provider_name) }} />
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-6 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Ημερησια δραστηριοτητα */}
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ημερήσια Δραστηριότητα</h3>
                  <div className="space-y-2">
                    {globalStats.daily_breakdown?.map(({ day, count }) => {
                      const max = Math.max(...(globalStats.daily_breakdown?.map(d => d.count) || [1]))
                      return (
                        <div key={day} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-24 flex-shrink-0">{day}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-gray-700" style={{ width: `${(count / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-8 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Ολα τα events */}
                <div className="bg-white border rounded-xl p-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Όλα τα Events ({globalStats.total_events})</h3>
                  <div className="space-y-2">
                    {globalStats.by_event_type?.map(({ event_type, count }) => (
                      <div key={event_type} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-600 font-mono">{event_type}</span>
                        <span className="text-sm font-bold text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Υγεία */}
      {tab === 'Υγεία' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">System Health</h2>
              <button
                onClick={refreshHealth}
                disabled={healthLoading}
                className="text-xs text-gray-400 hover:text-gray-700 font-bold disabled:opacity-40"
              >
                {healthLoading ? '...' : '↻ Refresh'}
              </button>
            </div>

            {!health ? (
              <p className="text-gray-400 text-sm">Φόρτωση...</p>
            ) : (
              <div className="space-y-2">
                {SERVICES.map(({ key, label}) => {
                  const status = health[key]
                  const up = status === 'UP'
                  return (
                    <div key={key} className="flex items-center justify-between p-4 rounded-lg border bg-white">
                      <div>
                        <p className="font-semibold text-gray-900">{label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${up ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className={`text-sm font-bold ${up ? 'text-green-600' : 'text-red-600'}`}>
                          {status || 'DOWN'}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {health.pending_retry_events !== null && (
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-white">
                    <div>
                      <p className="font-semibold text-gray-900">Retry Queue</p>
                      <p className="text-xs text-gray-400">pending events</p>
                    </div>
                    <span className={`text-sm font-bold ${health.pending_retry_events > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {health.pending_retry_events}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Πάροχοι */}
      {tab === 'Πάροχοι' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {Object.entries(providerStats).length === 0 ? (
              <p className="text-gray-400 text-sm">Δεν υπάρχουν διαθέσιμα δεδομένα παρόχων.</p>
            ) : (
              Object.entries(providerStats).map(([name, s]) => {
                const registered = providers.find(p => p.providerName === name)
                return (
                  <div key={name} className="bg-white border rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getColor(name) }} />
                        <span className="font-bold text-gray-900">{name}</span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Κρατήσεις</span>
                        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">Live</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{s.total} σημεια</span>
                        {registered && (
                          <button onClick={() => handleDeleteProvider(name)}
                            className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-3 py-1 rounded-lg transition-colors">
                            Διαγραφη
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Stats — δυναμικα ανα status */}
                    {(() => {
                      const STATUS_MAP = {
                        available:   { label: 'Διαθεσιμα', color: 'text-green-600' },
                        reserved:    { label: 'Κρατημενα', color: 'text-amber-500' },
                        held:        { label: 'Κρατημενα', color: 'text-amber-500' },
                        malfunction: { label: 'Βλαβη',     color: 'text-red-500'   },
                        offline:     { label: 'Offline',   color: 'text-gray-400'  },
                        charging:    { label: 'Φορτιζει',  color: 'text-blue-500'  },
                      }
                      const entries = Object.entries(s.statuses || {}).sort((a, b) => b[1] - a[1])
                      const cols = entries.length <= 3 ? entries.length : entries.length <= 4 ? 4 : 3
                      return (
                        <div className={`grid grid-cols-${cols} gap-px bg-gray-100`}>
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
                    <div className="px-5 py-2 border-t bg-gray-50 flex items-center justify-between">
                      {registered?.apiBaseUrl
                        ? <p className="text-xs text-gray-400 font-mono">{registered.apiBaseUrl}</p>
                        : <span />
                      }
                      <button
                        onClick={async () => {
                          const now = new Date()
                          const total = s.total
                          try {
                            await axios.post('/api/orchestrator/invoices/generate', {
                              providerName: name,
                              month: now.getMonth() + 1,
                              year: now.getFullYear(),
                              totalPoints: total
                            })
                            alert(`Invoice παραχθηκε για ${name}`)
                          } catch (e) {
                            alert(e.response?.data?.detail || 'Σφάλμα παραγωγής invoice')
                          }
                        }}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                      >
                        + Invoice τρέχοντος μήνα
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Κρατήσεις */}
      {tab === 'Κρατήσεις' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Διαχειίριση Κρατήσεων</h2>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">
                  {reservations.filter(r => r.status === 'ACTIVE' && !(new Date(r.endTime + 'Z') < new Date())).length} ενεργές
                </span>
                <button
                  onClick={() => setShowCancelled(v => !v)}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border transition-colors ${
                    showCancelled
                      ? 'bg-gray-200 text-gray-700 border-gray-300'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {showCancelled ? 'Κρυψε' : `+ ${reservations.filter(r => r.status === 'CANCELLED' || new Date(r.endTime + 'Z') < new Date()).length} ακυρωμενες/ληγμενες`}
                </button>
              </div>
              <button
                onClick={fetchReservations}
                disabled={resLoading}
                className="text-xs text-gray-400 hover:text-gray-700 font-bold disabled:opacity-40"
              >
                {resLoading ? '...' : '↻ Refresh'}
              </button>
            </div>

            {reservations.length === 0 ? (
              <p className="text-gray-400 text-sm">Δεν υπάρχουν κρατήσεις.</p>
            ) : (
              <div className="space-y-2">
                {reservations.filter(r => {
                  const expired = r.status === 'ACTIVE' && !r.endTime?.startsWith('1970') && r.endTime && new Date(r.endTime + 'Z') < new Date()
                  if (expired) return showCancelled
                  return showCancelled || r.status === 'ACTIVE'
                }).map(r => {
                  const expired = r.status === 'ACTIVE' && !r.endTime?.startsWith('1970') && r.endTime && new Date(r.endTime + 'Z') < new Date()
                  const active = r.status === 'ACTIVE' && !expired
                  const pt = points.find(p => String(p.pointId) === String(r.pointId))
                  const fmtDate = (s) => s && !s.startsWith('1970') ? new Date(s + 'Z').toLocaleString('el-GR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
                  const endDisplay = fmtDate(r.endTime)
                  return (
                    <div key={r.id} className={`bg-white border rounded-lg p-4 flex items-start justify-between gap-4 ${!active ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
                          {pt?.providerName && (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getColor(pt.providerName) }} />
                              <span className="text-sm font-bold" style={{ color: getColor(pt.providerName) }}>{pt.providerName}</span>
                            </span>
                          )}
                          <span className="font-semibold text-gray-900 text-sm">
                            {pt?.locationName || `Point ${r.pointId}`}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ml-1 ${
                            active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                          }`}>{r.status}</span>
                        </div>

                        {/* Detail rows */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-gray-500 mb-1">
                          <span>Χρηστης: <strong className="text-gray-700">{r.userID}</strong></span>
                          {pt?.address && <span>Διευθυνση: <strong className="text-gray-700">{pt.address}</strong></span>}
                          <span>Εναρξη: <strong className="text-gray-700">{fmtDate(r.startTime)}</strong></span>
                          <span>Ληξη: <strong className="text-gray-700">{endDisplay}</strong></span>
                          {pt?.pricePerKwh && <span>Τιμη: <strong className="text-gray-700">{pt.pricePerKwh} €/kWh</strong></span>}
                          {pt?.connector && <span>Connector: <strong className="text-gray-700">{pt.connector}</strong></span>}
                          {pt?.cap && <span>Ισχυς: <strong className="text-gray-700">{pt.cap} kW</strong></span>}
                        </div>

                        <p className="text-[10px] text-gray-300 mt-1.5 font-mono">{r.id}</p>
                      </div>
                      {active && (
                        <button
                          onClick={() => handleCancelReservation(r.id)}
                          className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 mt-1"
                        >
                          Ακυρωση
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
