import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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

export default function MapSearch() {
  const { user } = useAuth()
  const { getProviderInfo } = useProviders()
  const [points, setPoints] = useState([])
  const [selected, setSelected] = useState(null)

  const fetchPoints = () => {
    axios.get('/api/orchestrator/search')
      .then(res => setPoints(res.data || []))
      .catch(() => {})
  }

  useEffect(() => { fetchPoints() }, [])

  const handleReserve = async (p) => {
    try {
      const res = await axios.post('/api/orchestrator/reserve', {
        pointId: p.pointId,
        userId: user?.name || 'user1',
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

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <div className="flex-1">
        <MapContainer center={[37.98, 23.73]} zoom={11} className="h-full w-full">
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

      <div className="w-80 bg-white border-l shadow-lg flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Σημεία φόρτισης</span>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{points.length}</span>
              <button onClick={fetchPoints} className="text-xs text-gray-400 hover:text-gray-600 font-bold">↻</button>
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
          onReserve={handleReserve}
          showReserve={true}
        />
      </div>
    </div>
  )
}
