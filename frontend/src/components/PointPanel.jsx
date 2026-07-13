import { getColor } from './markerIcon'

const STATUS = {
  available:   { label: 'Διαθέσιμο',  cls: 'bg-green-500' },
  reserved:    { label: 'Κρατημένο',  cls: 'bg-amber-400' },
  malfunction: { label: 'Βλάβη',      cls: 'bg-red-500'   },
}

function Row({ label, value, bold = false }) {
  if (!value) return null
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm text-gray-900 ${bold ? 'font-bold' : 'font-medium'}`}>{value}</p>
    </div>
  )
}

export default function PointPanel({ point, providerInfo, onClose, onReserve, showReserve = false }) {
  if (!point) return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center select-none">
      <p className="text-sm font-semibold text-gray-400">Επίλεξε σημείο</p>
      <p className="text-xs text-gray-300 mt-1">Κλίκαρε σε ένα marker</p>
    </div>
  )

  const s = STATUS[point.status] || { label: point.status, cls: 'bg-gray-400' }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: getColor(point.providerName) }}>{point.providerName}</p>
            <p className="font-bold text-gray-900 text-[15px] leading-snug">
              {point.locationName || `Σημείο ${point.pointId}`}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors mt-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2 mt-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.cls} flex-shrink-0`} />
            <span className="text-xs font-bold text-gray-600">{s.label}</span>
          </div>
          {providerInfo?.supportsReservations && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Κρατηση</span>
          )}
          {providerInfo?.hasLiveStatus && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">Live</span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-auto px-5 py-1">
        <Row label="Διευθυνση" value={point.address} />
        <Row label="Τιμη" value={point.pricePerKwh ? `${point.pricePerKwh} €/kWh` : null} bold />
        <Row label="Ισχυς" value={point.cap ? `${point.cap} kW` : null} />
        <Row label="Connector" value={point.connector} />
        <Row label="Δεσμευμενο εως" value={point.reservationEnd} />
        <Row label="ID" value={point.pointId} />
      </div>

      {showReserve && point.status === 'available' && (
        <div className="p-4 border-t space-y-2">
          {point.pricePerKwh && point.cap && (
            <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span>Εκτιμώμενο κόστος (60 λεπτά)</span>
              <span className="font-bold text-gray-800">
                ~{((point.pricePerKwh * point.cap * 1) / 1).toFixed(2)}€
              </span>
            </div>
          )}
          <button
            onClick={() => onReserve(point)}
            className="w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
          >
            Κράτηση 60 λεπτων
          </button>
        </div>
      )}
    </div>
  )
}
