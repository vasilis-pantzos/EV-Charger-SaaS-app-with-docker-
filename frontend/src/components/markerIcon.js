import L from 'leaflet'

const PROVIDER_COLORS = {
  redplug:   '#ef4444',
  greenplug: '#22c55e',
  blueplug:  '#3b82f6',
}

export function getColor(providerName) {
  const key = providerName?.toLowerCase().replace(/\s+/g, '') || ''
  return PROVIDER_COLORS[key] || '#6b7280'
}

export function markerIcon(providerName) {
  const color = getColor(providerName)
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z"
        fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  })
}
