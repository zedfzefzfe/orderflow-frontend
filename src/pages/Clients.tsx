import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet } from '@/lib/api'
import { formatPhone, timeAgo } from '@/lib/dateUtils'
import { Input } from '@/components/ui/input'
import { Search, X, AlertTriangle, Users, ArrowLeft } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  phone: string
  names: string[]
  totalOrders: number
  delivered: number
  clientFaultReturns: number
  reporteClient: number
  legitReturns: number
  faultPoints: number
  riskScore: number
  riskLevel: 'FIABLE' | 'A_SURVEILLER' | 'MAUVAIS'
  lastOrderAt: string | null
}

interface ClientOrder {
  id: string
  product: string
  quantity: number
  status: string
  returnReason: string | null
  totalPrice: number | null
  deliveryPrice: number | null
  createdAt: string
  customerName: string
  address: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  FIABLE:       { label: 'Fiable',        className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  A_SURVEILLER: { label: 'À surveiller',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  MAUVAIS:      { label: 'Mauvais',       className: 'bg-red-50 text-red-700 border-red-200' },
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  CONFIRMED:    { label: 'Confirmé',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  EN_LIVRAISON: { label: 'En livraison',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  LIVRE:        { label: 'Livré ✓',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DELIVERED:    { label: 'Livré ✓',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RETOURNE:     { label: 'Retourné',      cls: 'bg-red-50 text-red-700 border-red-200' },
  ANNULE:       { label: 'Annulé',        cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  CANCELLED:    { label: 'Annulé',        cls: 'bg-gray-50 text-gray-500 border-gray-200' },
}

const RETURN_REASON_LABEL: Record<string, string> = {
  INJOIGNABLE:            'Injoignable',
  REFUSE_LIVRAISON:       'Refus de livraison',
  FAUSSE_COMMANDE:        'Fausse commande',
  ANNULE_AVANT_LIVRAISON: 'Annulé avant livraison',
  REPORTE_CLIENT:         'Reporté par le client',
  MAUVAISE_ADRESSE:       'Mauvaise adresse',
  PROBLEME_PRODUIT:       'Problème produit',
  AUTRE:                  'Autre',
}

const RISK_FILTERS = [
  { value: 'ALL',          label: 'Tous' },
  { value: 'MAUVAIS',      label: '🔴 Mauvais' },
  { value: 'A_SURVEILLER', label: '🟡 À surveiller' },
  { value: 'FIABLE',       label: '🟢 Fiable' },
]

// ── Customer Detail Drawer ────────────────────────────────────────────────────

function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [globalWarning, setGlobalWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const phone = encodeURIComponent(customer.phone)
    Promise.all([
      apiGet(`/api/orders/client/${phone}`),
      apiGet(`/api/customers/global-risk?phone=${phone}`),
    ])
      .then(([historyData, riskData]) => {
        setOrders(historyData.orders ?? [])
        if (riskData.warn && riskData.message) setGlobalWarning(riskData.message)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customer.phone])

  const badge = RISK_BADGE[customer.riskLevel] ?? RISK_BADGE.FIABLE
  const displayName = customer.names[0] ?? customer.phone

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400">{formatPhone(customer.phone)}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${badge.className}`}>
            {badge.label}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cross-merchant warning */}
        {globalWarning && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-start gap-2.5 shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{globalWarning}</p>
          </div>
        )}

        {/* Score + stats */}
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Score de risque</span>
            <span className="font-semibold text-gray-800 tabular-nums">{customer.riskScore} / 100</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                customer.riskScore >= 50 ? 'bg-red-500' :
                customer.riskScore >= 20 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(customer.riskScore, 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2.5 text-xs">
            <span className="text-gray-500">{customer.totalOrders} commandes</span>
            <span className="text-gray-300">·</span>
            <span className="text-emerald-600 font-medium">{customer.delivered} livrées</span>
            <span className="text-gray-300">·</span>
            <span className={customer.clientFaultReturns > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
              {customer.clientFaultReturns} refus client
            </span>
            {customer.reporteClient > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-amber-600">{customer.reporteClient} reporté</span>
              </>
            )}
          </div>
        </div>

        {/* Multiple names */}
        {customer.names.length > 1 && (
          <div className="px-5 py-2.5 border-b border-gray-100 shrink-0">
            <p className="text-xs text-gray-400 mb-1">Noms utilisés</p>
            <p className="text-xs text-gray-600 leading-relaxed">{customer.names.join(' · ')}</p>
          </div>
        )}

        {/* Orders */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">Chargement…</div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">Aucune commande</div>
          ) : orders.map((o) => {
            const meta = STATUS_META[o.status] ?? { label: o.status, cls: 'bg-gray-50 text-gray-500 border-gray-200' }
            const cod = (o.totalPrice ?? 0) + (o.deliveryPrice ?? 0)
            return (
              <div key={o.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate flex-1">{o.product}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500 mt-1">
                  {o.customerName && <span className="text-gray-600">{o.customerName}</span>}
                  {cod > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="font-medium text-gray-700">{cod.toLocaleString('fr-FR')} DH</span>
                    </>
                  )}
                  <span className="text-gray-300">·</span>
                  <span>{timeAgo(o.createdAt)}</span>
                </div>
                {o.returnReason && (
                  <p className="text-xs text-red-500 mt-1.5">
                    ↩ {RETURN_REASON_LABEL[o.returnReason] ?? o.returnReason}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Clients() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [selected, setSelected] = useState<Customer | null>(null)

  useEffect(() => {
    apiGet('/api/customers')
      .then(setCustomers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!user) { navigate('/'); return null }

  const filtered = useMemo(() => {
    let list = customers
    if (riskFilter !== 'ALL') list = list.filter(c => c.riskLevel === riskFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.phone.includes(q) ||
        c.names.some(n => n.toLowerCase().includes(q))
      )
    }
    return list
  }, [customers, riskFilter, search])

  const counts = useMemo(() => ({
    MAUVAIS:      customers.filter(c => c.riskLevel === 'MAUVAIS').length,
    A_SURVEILLER: customers.filter(c => c.riskLevel === 'A_SURVEILLER').length,
    FIABLE:       customers.filter(c => c.riskLevel === 'FIABLE').length,
  }), [customers])

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-16">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Scoring de fiabilité basé sur l'historique des livraisons
        </p>
      </div>

      {/* Summary chips */}
      {!loading && customers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full font-medium">
            🔴 {counts.MAUVAIS} mauvais
          </span>
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full font-medium">
            🟡 {counts.A_SURVEILLER} à surveiller
          </span>
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
            🟢 {counts.FIABLE} fiables
          </span>
        </div>
      )}

      {/* Search + risk filter */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Téléphone ou nom…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white border-gray-200 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {RISK_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setRiskFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                riskFilter === f.value
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!loading && (
          <span className="text-xs text-gray-400 ml-auto tabular-nums">
            {filtered.length} client{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400">
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Users className="h-10 w-10 mb-3 opacity-25" />
            <p className="text-sm">Aucun client{riskFilter !== 'ALL' || search ? ' pour ce filtre' : ''}</p>
            {customers.length === 0 && (
              <p className="text-xs mt-1 text-gray-300">
                Les clients apparaissent après leur première commande livrée ou retournée
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Téléphone</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Noms</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Cmd.</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Livrées</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Refus</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Score</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Risque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => {
                  const badge = RISK_BADGE[c.riskLevel] ?? RISK_BADGE.FIABLE
                  return (
                    <tr
                      key={c.phone}
                      onClick={() => setSelected(c)}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors duration-100"
                    >
                      <td className="px-5 py-3.5 font-mono text-sm text-gray-700 whitespace-nowrap">
                        {formatPhone(c.phone)}
                      </td>
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <p className="truncate text-gray-800">{c.names[0] ?? '—'}</p>
                        {c.names.length > 1 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            +{c.names.length - 1} autre{c.names.length > 2 ? 's' : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center text-gray-600 tabular-nums">
                        {c.totalOrders}
                      </td>
                      <td className="px-4 py-3.5 text-center text-emerald-600 font-medium tabular-nums">
                        {c.delivered}
                      </td>
                      <td className="px-4 py-3.5 text-center tabular-nums">
                        <span className={c.clientFaultReturns > 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                          {c.clientFaultReturns}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-14 bg-gray-100 rounded-full h-1.5 shrink-0">
                            <div
                              className={`h-1.5 rounded-full ${
                                c.riskScore >= 50 ? 'bg-red-500' :
                                c.riskScore >= 20 ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${Math.min(c.riskScore, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-gray-500 w-5 text-right">{c.riskScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
