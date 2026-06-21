import { X, Phone, MapPin, Package, Hash, Calendar, DollarSign, MessageSquare } from 'lucide-react'
import { formatDateFr, formatPhone, timeAgo } from '@/lib/dateUtils'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export interface Order {
  id: string
  customerName: string
  customerPhone: string
  product: string
  quantity: number
  address: string | null
  deliveryDate: string | null
  price: number | null
  totalPrice: number | null
  deliveryPrice: number | null
  needsReview: boolean
  status: 'CONFIRMED' | 'EN_LIVRAISON' | 'LIVRE' | 'RETOURNE' | 'ANNULE' | 'DELIVERED' | 'CANCELLED'
  deliveredAt?: string | null
  rawMessage: string
  source: string
  createdAt: string
  clientWarning?: string | null
  localWarning?: string | null
}

export const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:    'bg-blue-100 text-blue-800 border-blue-200',
  EN_LIVRAISON: 'bg-amber-100 text-amber-800 border-amber-200',
  LIVRE:        'bg-emerald-100 text-emerald-800 border-emerald-200',
  RETOURNE:     'bg-red-100 text-red-800 border-red-200',
  ANNULE:       'bg-gray-100 text-gray-600 border-gray-200',
  DELIVERED:    'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED:    'bg-gray-100 text-gray-600 border-gray-200',
}

export const STATUS_LABELS: Record<string, string> = {
  CONFIRMED:    'Confirmé',
  EN_LIVRAISON: 'En livraison',
  LIVRE:        'Livré ✓',
  RETOURNE:     'Retourné',
  ANNULE:       'Annulé',
  DELIVERED:    'Livré',
  CANCELLED:    'Annulé',
}

interface OrderDrawerProps {
  order: Order | null
  onClose: () => void
  onStatusChange: (orderId: string, status: string) => void
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="p-1.5 bg-gray-100 rounded-md mt-0.5">
        <Icon className="h-3.5 w-3.5 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 mt-0.5 break-words">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function OrderDrawer({ order, onClose, onStatusChange }: OrderDrawerProps) {
  if (!order) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold text-gray-900">{order.customerName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(order.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          <Row icon={Phone} label="Téléphone" value={formatPhone(order.customerPhone)} />
          <Row icon={Package} label="Produit" value={order.product} />
          <Row icon={Hash} label="Quantité" value={String(order.quantity)} />
          <Row icon={MapPin} label="Adresse" value={order.address} />
          <Row icon={Calendar} label="Livraison" value={
            order.deliveryDate
              ? `${formatDateFr(order.deliveryDate)} ${order.deliveryDate !== formatDateFr(order.deliveryDate) ? `(${order.deliveryDate})` : ''}`
              : null
          } />
          {order.totalPrice && (
            <Row icon={DollarSign} label="Prix total" value={`${order.totalPrice} DH`} />
          )}

          {/* Raw message */}
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Message original</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 italic leading-relaxed border">
              "{order.rawMessage}"
            </div>
          </div>

          {order.source === 'simulator' && (
            <div className="pt-1">
              <span className="inline-flex items-center text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100">
                🧪 Simulé
              </span>
            </div>
          )}
        </div>

        {/* Status footer */}
        <div className="px-5 py-4 border-t bg-gray-50">
          <p className="text-xs font-medium text-gray-500 mb-2">Statut de la commande</p>
          <Select value={order.status} onValueChange={(val) => onStatusChange(order.id, val)}>
            <SelectTrigger className="w-full">
              <Badge
                variant="outline"
                className={`${STATUS_COLORS[order.status]} text-sm font-medium`}
              >
                {STATUS_LABELS[order.status]}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[key]}`}>
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )
}
