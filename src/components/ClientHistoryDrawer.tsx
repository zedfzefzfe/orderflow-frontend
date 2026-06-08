import { useEffect, useState } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { formatPhone, formatDateFr } from '@/lib/dateUtils'
import type { Order } from './OrderDrawer'

interface ClientHistory {
  orders: Order[]
  totalCA: number
  totalOrders: number
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: '✅ Confirmé',
  DELIVERED: '📦 Livré',
  CANCELLED: '❌ Annulé',
}

const STATUS_CLASS: Record<string, string> = {
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

interface Props {
  phone: string
  name: string
  onClose: () => void
}

export default function ClientHistoryDrawer({ phone, name, onClose }: Props) {
  const [history, setHistory] = useState<ClientHistory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiGet(`/api/orders/client/${encodeURIComponent(phone)}`)
      .then(setHistory)
      .catch(() => setHistory({ orders: [], totalCA: 0, totalOrders: 0 }))
      .finally(() => setLoading(false))
  }, [phone])

  const waHref = `https://wa.me/${phone.replace(/\s/g, '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '212')}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white shadow-xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{name}</p>
            <p className="text-xs text-gray-400">{formatPhone(phone)}</p>
          </div>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-300 hover:text-green-500 transition-colors"
            title="Ouvrir WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats bar */}
        {history && !loading && (
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3 text-sm">
            <span className="font-semibold text-emerald-700">
              📊 {history.totalOrders} commande{history.totalOrders !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-400">·</span>
            <span className="font-semibold text-emerald-700">
              {history.totalCA.toLocaleString('fr-FR')} DH CA
            </span>
          </div>
        )}

        {/* Order list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Chargement…
            </div>
          )}

          {!loading && history?.orders.length === 0 && (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Aucune commande trouvée
            </div>
          )}

          {!loading && history?.orders.map(order => {
            const orderTotal = (order.price ?? 0) * (order.quantity ?? 1) + (order.deliveryPrice ?? 0)
            return (
              <div key={order.id} className="px-5 py-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 text-sm leading-snug">{order.product}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CLASS[order.status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  {orderTotal > 0 && <span className="font-medium text-gray-700">{orderTotal.toLocaleString('fr-FR')} DH</span>}
                  {order.address && <><span className="text-gray-300">·</span><span>{order.address}</span></>}
                  {order.deliveryDate && <><span className="text-gray-300">·</span><span>{formatDateFr(order.deliveryDate)}</span></>}
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
