import { useState } from 'react'
import axios from 'axios'

export default function ProviderRegister() {
  const [form, setForm] = useState({
    providerName: '', apiBaseUrl: '', apiKey: '',
    listPointsEndpoint: '', supportsReservations: false, hasLiveStatus: false
  })
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post('/api/orchestrator/providers/register', form)
      setMessage('Εγγραφή επιτυχής!')
    } catch (err) {
      setMessage('Σφάλμα εγγραφής: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Εγγραφή Παρόχου</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input placeholder="Επωνυμία Παρόχου" value={form.providerName}
          onChange={e => setForm({...form, providerName: e.target.value})}
          className="w-full border p-2 rounded" required />
        <input placeholder="API Base URL" value={form.apiBaseUrl}
          onChange={e => setForm({...form, apiBaseUrl: e.target.value})}
          className="w-full border p-2 rounded" required />
        <input placeholder="API Key" value={form.apiKey}
          onChange={e => setForm({...form, apiKey: e.target.value})}
          className="w-full border p-2 rounded" required />
        <input placeholder="List Points Endpoint" value={form.listPointsEndpoint}
          onChange={e => setForm({...form, listPointsEndpoint: e.target.value})}
          className="w-full border p-2 rounded" required />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.supportsReservations}
            onChange={e => setForm({...form, supportsReservations: e.target.checked})} />
          Υποστηρίζει κρατήσεις
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.hasLiveStatus}
            onChange={e => setForm({...form, hasLiveStatus: e.target.checked})} />
          Υποστηρίζει live status
        </label>
        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded font-semibold">
          Εγγραφή
        </button>
      </form>
      {message && <p className="mt-4 text-center font-semibold">{message}</p>}
    </div>
  )
}