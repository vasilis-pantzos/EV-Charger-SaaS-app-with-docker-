// All 3 providers (bluePlug, greenPlug, redPlug) confirmed via OpenAPI specs to support
// both reservations and live status per-point lookup.
const PROVIDER_CAPABILITIES = {
  redplug:   { supportsReservations: true, hasLiveStatus: true },
  greenplug: { supportsReservations: true, hasLiveStatus: true },
  blueplug:  { supportsReservations: true, hasLiveStatus: true },
}

export function useProviders() {
  const getProviderInfo = (providerName) => {
    const key = providerName?.toLowerCase().replace(/\s+/g, '') || ''
    return PROVIDER_CAPABILITIES[key] || { supportsReservations: false, hasLiveStatus: false }
  }

  return { getProviderInfo }
}
