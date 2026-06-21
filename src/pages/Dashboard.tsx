import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import jsPDF from 'jspdf'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Package, CheckCircle, AlertCircle, Search, Inbox,
  Phone, XCircle, Truck, CalendarClock,
  Pencil, Trash2, Check, X, TriangleAlert, Bell, BellOff, RotateCcw,
} from 'lucide-react'
import { formatDateFr, formatPhone, timeAgo } from '@/lib/dateUtils'
import SimulatorModal from '@/components/SimulatorModal'
import OrderDrawer, { type Order, STATUS_LABELS } from '@/components/OrderDrawer'
import PlanBanner from '@/components/PlanBanner'
import ClientHistoryDrawer from '@/components/ClientHistoryDrawer'
import useOrderNotifications from '@/hooks/useOrderNotifications'
import usePushNotifications from '@/hooks/usePushNotifications'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Stats {
  totalOrders: number
  ordersThisWeek: number
  pendingOrders: number
  needsReviewCount: number
  statusBreakdown: Record<string, number>
}

interface Cashflow {
  caEncaisse: number
  enAttente: number
  nbLivrees: number
  aConfirmer: number
  tauxLivraison: number
}

type Period = 'today' | 'week' | 'month' | 'all'

interface UrgencyInfo {
  label: string
  badgeClass: string
  stripColor: string
  diffDays: number
}

interface EditDraft {
  customerName: string
  customerPhone: string
  product: string
  quantity: string
  price: string
  address: string
  deliveryDate: string
  deliveryPrice: string
  status: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  CONFIRMED:    'bg-blue-50 text-blue-700 border-blue-200',
  EN_LIVRAISON: 'bg-amber-50 text-amber-700 border-amber-200',
  LIVRE:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETOURNE:     'bg-red-50 text-red-700 border-red-200',
  ANNULE:       'bg-gray-50 text-gray-500 border-gray-200',
  DELIVERED:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED:    'bg-gray-50 text-gray-500 border-gray-200',
}

const STATUS_ICON: Record<string, React.ElementType> = {
  CONFIRMED:    CheckCircle,
  EN_LIVRAISON: Truck,
  LIVRE:        Package,
  RETOURNE:     RotateCcw,
  ANNULE:       XCircle,
  DELIVERED:    Package,
  CANCELLED:    XCircle,
}

const STATUS_STRIP_COLOR: Record<string, string> = {
  CONFIRMED:    '#93c5fd',
  EN_LIVRAISON: '#fcd34d',
  LIVRE:        '#34d399',
  RETOURNE:     '#fca5a5',
  ANNULE:       '#e5e7eb',
  DELIVERED:    '#34d399',
  CANCELLED:    '#fca5a5',
}

const KPI_BORDER: Record<string, string> = {
  total: 'border-l-gray-300',
  needsReview: 'border-l-yellow-400',
  confirmed: 'border-l-blue-400',
  delivered: 'border-l-emerald-500',
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'all', label: 'Tout' },
]

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Tous' },
  { value: 'CONFIRMED', label: 'Confirmé' },
  { value: 'DELIVERED', label: 'Livré' },
  { value: 'CANCELLED', label: 'Annulé' },
]

const showSimulator = import.meta.env.DEV || import.meta.env.VITE_ENABLE_SIMULATOR === 'true'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriodStart(period: Period): string | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }
  const days = period === 'week' ? 6 : 29
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Parses any delivery date string → Date or null.
// Primary: ISO format (new orders from updated LLM parser).
// Fallback: French text like "7 juin", "demain", "lundi" (legacy DB values).
function parseDeliveryDate(raw: string): Date | null {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // 1. ISO / standard parseable date
  const iso = new Date(raw)
  if (!isNaN(iso.getTime())) { iso.setHours(0, 0, 0, 0); return iso }

  const s = raw.toLowerCase().trim()

  // 2. Relative keywords
  if (s.includes("aujourd") || s === 'ce soir') return new Date(today)
  if (s.startsWith('demain') || s === 'ghda' || s === 'l-ghda') {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d
  }
  if (s.includes('semaine prochaine') || s === 'simana jaya') {
    const d = new Date(today); d.setDate(d.getDate() + 7); return d
  }

  // 3. French day names → next occurrence
  const DAY: Record<string, number> = {
    dimanche: 0, dim: 0, lhad: 0,
    lundi: 1, lun: 1,
    mardi: 2, mar: 2,
    mercredi: 3, mer: 3,
    jeudi: 4, jeu: 4, lkhmis: 4,
    vendredi: 5, ven: 5,
    samedi: 6, sam: 6,
  }
  for (const [name, dayNum] of Object.entries(DAY)) {
    if (s === name || s.startsWith(name + ' ') || s.startsWith('nhar ' + name)) {
      let diff = (dayNum - today.getDay() + 7) % 7
      if (diff === 0) diff = 7
      const d = new Date(today); d.setDate(d.getDate() + diff); return d
    }
  }

  // 4. French "7 juin", "15 mars" etc.
  const MONTH: Record<string, number> = {
    janvier: 0, jan: 0, février: 1, fev: 1, fév: 1, mars: 2, mar: 2,
    avril: 3, avr: 3, mai: 4, juin: 5, juillet: 6, juil: 6,
    août: 7, aout: 7, aoû: 7, septembre: 8, sep: 8, sept: 8,
    octobre: 9, oct: 9, novembre: 10, nov: 10, décembre: 11, dec: 11, déc: 11,
  }
  const m = s.match(/^(\d{1,2})\s+([^\s\d]+)/)
  if (m) {
    const day = parseInt(m[1], 10)
    const monthNum = MONTH[m[2]]
    if (monthNum !== undefined && day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), monthNum, day)
      if (d < today) d.setFullYear(today.getFullYear() + 1)
      return d
    }
  }

  return null
}

function getDeliveryUrgency(deliveryDate: string | null): UrgencyInfo | null {
  if (!deliveryDate) return null
  const d = parseDeliveryDate(deliveryDate)
  if (!d) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const cutoff = new Date(today); cutoff.setDate(today.getDate() + 3); cutoff.setHours(23, 59, 59, 999)
  if (d < today || d > cutoff) return null
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return { label: "Aujourd'hui", badgeClass: 'bg-red-100 text-red-700 border-red-200', stripColor: '#ef4444', diffDays }
  if (diffDays === 1) return { label: 'Demain', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200', stripColor: '#f97316', diffDays }
  if (diffDays === 2) return { label: 'Dans 2 jours', badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200', stripColor: '#eab308', diffDays }
  if (diffDays === 3) return { label: 'Dans 3 jours', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200', stripColor: '#f59e0b', diffDays }
  return null
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const Icon = STATUS_ICON[status] || AlertCircle
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_PILL[status] || ''}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {STATUS_LABELS[status]}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-50">
      <td style={{ width: 4, padding: 0 }} className="bg-gray-100" />
      {[36, 28, 48, 10, 20, 36, 24, 28].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className={`h-3.5 bg-gray-100 rounded w-${w} max-w-full`} />
        </td>
      ))}
      <td className="w-16 px-4 py-4" />
    </tr>
  )
}

function StatCard({ label, value, icon: Icon, subtext, borderClass, iconBg, iconColor }: {
  label: string; value: number | undefined; icon: React.ElementType
  subtext?: string; borderClass: string; iconBg: string; iconColor: string
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderClass} px-5 py-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2 leading-none">
            {value === undefined
              ? <span className="inline-block animate-pulse bg-gray-100 rounded h-8 w-10" />
              : value}
          </p>
          {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
        </div>
        <div className={`p-2.5 rounded-xl shrink-0 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  )
}

// ── Mobile order card ─────────────────────────────────────────────────────────

function OrderCard({ order, onClick, urgency }: {
  order: Order; onClick: () => void; urgency?: UrgencyInfo | null
}) {
  const stripColor = urgency ? urgency.stripColor : STATUS_STRIP_COLOR[order.status]
  const URGENCY_CARD_BG: Record<number, string> = { 0: 'bg-red-50/40', 1: 'bg-orange-50/40', 2: 'bg-yellow-50/40', 3: 'bg-amber-50/40' }
  const cardBg = urgency ? (URGENCY_CARD_BG[urgency.diffDays] ?? 'bg-white') : 'bg-white'

  return (
    <div
      className={`${cardBg} rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all duration-150 active:scale-[0.99]`}
      onClick={onClick}
    >
      <div className="flex">
        <div style={{ width: 4, backgroundColor: stripColor, flexShrink: 0 }} />
        <div className="p-4 flex-1 space-y-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{order.customerName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{timeAgo(order.createdAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusPill status={order.status} />
              {order.needsReview && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-yellow-50 text-yellow-700 border-yellow-300"
                  title="Vérification recommandée - confiance faible"
                >
                  <TriangleAlert className="h-3 w-3" /> À vérifier
                </span>
              )}
              {urgency && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${urgency.badgeClass}`}>
                  {urgency.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 truncate flex-1">{order.product}</span>
            <span className="text-gray-400 ml-2 shrink-0 text-xs">×{order.quantity}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="truncate">{order.address || '—'}</span>
            {order.totalPrice !== null && (
              <span className="font-semibold text-emerald-600 ml-2 shrink-0">
                {order.totalPrice.toLocaleString('fr-FR')} DH
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ search, statusFilter, onSimulated }: {
  search: string; statusFilter: string; onSimulated: () => void
}) {
  const hasFilter = search || statusFilter !== 'ALL'
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center px-6">
      <div className="p-5 bg-gray-100 rounded-2xl">
        <Inbox className="h-10 w-10 text-gray-400" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-gray-700 text-base">Aucune commande</p>
        <p className="text-sm text-gray-400">
          {hasFilter ? 'Aucun résultat pour ces filtres.' : 'Simulez une première commande pour tester le parsing IA.'}
        </p>
      </div>
      {showSimulator && !hasFilter && <SimulatorModal onOrderCreated={onSimulated} />}
    </div>
  )
}

// ── PDF label generator ──────────────────────────────────────────────────────

function generateLabels(orders: Order[], businessName: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] })
  const W = 100, M = 5, CW = W - M * 2

  const hline = (y: number) => {
    doc.setDrawColor(220, 220, 220)
    doc.line(M, y, W - M, y)
  }

  orders.forEach((order, idx) => {
    if (idx > 0) doc.addPage()
    let y = 0

    // Border
    doc.setDrawColor(200, 200, 200)
    doc.rect(0.5, 0.5, 99, 149)

    // ── Header band ──
    doc.setFillColor(16, 185, 129)
    doc.rect(0, 0, W, 16, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('ORDERFLOW', M, 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(businessName, W - M, 11, { align: 'right' })
    y = 21

    // ── Expéditeur ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('EXPEDITEUR', M, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(businessName, M, y); y += 8
    hline(y); y += 5

    // ── Destinataire ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('DESTINATAIRE', M, y); y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(15, 15, 15)
    const nameLines = doc.splitTextToSize(order.customerName || '—', CW)
    doc.text(nameLines, M, y); y += nameLines.length * 6 + 1

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.text(order.customerPhone || '—', M, y); y += 6

    doc.setFontSize(9)
    const addrLines = doc.splitTextToSize(order.address || '—', CW)
    doc.text(addrLines.slice(0, 3), M, y)
    y += Math.min(addrLines.length, 3) * 5 + 3

    hline(y); y += 6

    // ── Produit + Date ──
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('PRODUIT:', M, y)
    doc.setFont('helvetica', 'normal')
    const productText = doc.splitTextToSize(`${order.product} x${order.quantity}`, CW - 22)
    doc.text(productText[0], M + 22, y); y += 7

    doc.setFont('helvetica', 'bold')
    doc.text('LIVRAISON:', M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(order.deliveryDate ? formatDateFr(order.deliveryDate) : '—', M + 22, y); y += 7

    hline(y); y += 6

    // ── COD (large) ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text('MONTANT A ENCAISSER (COD)', W / 2, y, { align: 'center' }); y += 11

    const productTotal = order.totalPrice ?? 0
    const delivFee = order.deliveryPrice ?? 0
    const codTotal = productTotal + delivFee
    const cod = codTotal > 0 ? `${codTotal.toLocaleString('fr-FR')} DH` : 'Non specifie'
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(11, 120, 75)
    doc.text(cod, W / 2, y, { align: 'center' }); y += 13
    if (delivFee > 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 120)
      doc.text(`(dont ${delivFee.toLocaleString('fr-FR')} DH livraison)`, W / 2, y, { align: 'center' }); y += 6
    }

    hline(y); y += 5

    // ── Footer ──
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 160)
    doc.text(`Ref: ${order.id.slice(-8).toUpperCase()}`, M, y)
    doc.text(`Cree le: ${new Date(order.createdAt).toLocaleDateString('fr-FR')}`, W - M, y, { align: 'right' })
  })

  return doc
}

// ── Table head ───────────────────────────────────────────────────────────────

function TableHead({ showActions = false, selectable = false, allSelected = false, someSelected = false, onSelectAll }: {
  showActions?: boolean
  selectable?: boolean
  allSelected?: boolean
  someSelected?: boolean
  onSelectAll?: () => void
}) {
  return (
    <thead>
      <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
        <th style={{ width: 4, padding: 0 }} />
        {selectable && (
          <th className="pl-3 pr-1 py-3.5 w-9">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
              onChange={onSelectAll ?? (() => {})}
              readOnly={!onSelectAll}
              className="h-3.5 w-3.5 rounded accent-emerald-600 cursor-pointer"
              title="Tout sélectionner"
            />
          </th>
        )}
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Téléphone</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Produit</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-12 text-center">Qté</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Prix Produit</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Adresse</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Livraison</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Prix Livraison</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell w-28">Prix Total</th>
        <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Statut</th>
        {showActions && <th style={{ width: 72, padding: 0 }} />}
      </tr>
    </thead>
  )
}

// ── Inline delete confirmation row ───────────────────────────────────────────

function DeleteConfirmRow({ order, stripColor: _stripColor, onConfirm, onCancel }: {
  order: Order; stripColor: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <tr className="bg-red-50/60 border-b border-red-100">
      <td style={{ width: 4, padding: 0, backgroundColor: '#ef4444' }} />
      <td colSpan={20} className="px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Trash2 className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 font-medium">
            Supprimer la commande de <strong>{order.customerName}</strong> ?
          </span>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Oui, supprimer
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 transition-colors"
          >
            Annuler
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Inline edit row ───────────────────────────────────────────────────────────

function EditRowInline({ draft, onChange, onSave, onCancel, hasCheckbox }: {
  draft: EditDraft
  onChange: (field: keyof EditDraft, value: string) => void
  onSave: () => void
  onCancel: () => void
  hasCheckbox?: boolean
}) {
  const inp = 'w-full h-7 px-2 text-xs border border-blue-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 bg-white'
  return (
    <tr className="bg-blue-50/20 border-b border-blue-100">
      <td style={{ width: 4, padding: 0, backgroundColor: '#3b82f6' }} />
      {hasCheckbox && <td className="pl-3 pr-1 w-9" />}
      <td className="px-3 py-2 min-w-[120px]">
        <input className={inp} value={draft.customerName} onChange={e => onChange('customerName', e.target.value)} placeholder="Client" />
      </td>
      <td className="px-3 py-2 min-w-[120px]">
        <input className={inp} value={draft.customerPhone} onChange={e => onChange('customerPhone', e.target.value)} placeholder="Téléphone" />
      </td>
      <td className="px-3 py-2 min-w-[140px]">
        <input className={inp} value={draft.product} onChange={e => onChange('product', e.target.value)} placeholder="Produit" />
      </td>
      <td className="px-3 py-2 w-16">
        <input type="number" min="1" className={inp} value={draft.quantity} onChange={e => onChange('quantity', e.target.value)} placeholder="Qté" />
      </td>
      <td className="px-3 py-2 w-24">
        <input type="number" min="0" className={inp} value={draft.price} onChange={e => onChange('price', e.target.value)} placeholder="Prix" />
      </td>
      <td className="px-3 py-2 hidden lg:table-cell min-w-[120px]">
        <input className={inp} value={draft.address} onChange={e => onChange('address', e.target.value)} placeholder="Adresse" />
      </td>
      <td className="px-3 py-2 hidden lg:table-cell min-w-[100px]">
        <input className={inp} value={draft.deliveryDate} onChange={e => onChange('deliveryDate', e.target.value)} placeholder="Livraison" />
      </td>
      <td className="px-3 py-2 hidden lg:table-cell w-24">
        <input type="number" min="0" className={inp} value={draft.deliveryPrice} onChange={e => onChange('deliveryPrice', e.target.value)} placeholder="Frais liv." />
      </td>
      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
        <Select value={draft.status} onValueChange={val => onChange('status', val)}>
          <SelectTrigger className="h-7 text-xs border-blue-200 focus:ring-blue-300 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2 w-[120px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSave}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Check className="h-3 w-3" /> Sauvegarder
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Desktop order row ─────────────────────────────────────────────────────────

function OrderRow({ order, index, stripColor, onRowClick, onStatusChange: _onStatusChange, urgency, editable, onRowEditStart, onDeleteRequest, onSendToLivreur, onPrintLabel, selectable, selected, hasAnySelected, onToggleSelect, editingDeliveryId, editDeliveryValue, onDeliveryEditStart, onDeliveryEditChange, onDeliveryEditSave, onDeliveryEditCancel, onClientClick, onMarkLivre, onMarkRetourne, statusExpanded, onToggleStatusExpand }: {
  order: Order
  index: number
  stripColor: string
  onRowClick: () => void
  onStatusChange: (id: string, status: string) => void
  urgency?: UrgencyInfo | null
  editable?: boolean
  onRowEditStart?: () => void
  onDeleteRequest?: () => void
  onSendToLivreur?: () => void
  onPrintLabel?: () => void
  selectable?: boolean
  selected?: boolean
  hasAnySelected?: boolean
  onToggleSelect?: () => void
  editingDeliveryId?: string | null
  editDeliveryValue?: string
  onDeliveryEditStart?: (id: string, price: number | null) => void
  onDeliveryEditChange?: (v: string) => void
  onDeliveryEditSave?: (id: string) => void
  onDeliveryEditCancel?: () => void
  onClientClick?: (phone: string, name: string) => void
  onMarkLivre?: () => void
  onMarkRetourne?: () => void
  statusExpanded?: boolean
  onToggleStatusExpand?: () => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const URGENCY_ROW_BG: Record<number, string> = { 0: 'bg-red-50/30', 1: 'bg-orange-50/30', 2: 'bg-yellow-50/30', 3: 'bg-amber-50/30' }
  const rowBg = urgency
    ? (URGENCY_ROW_BG[urgency.diffDays] ?? (index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'))
    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'

  return (
    <tr
      className={`group ${rowBg} border-b border-gray-50 last:border-0 cursor-pointer hover:bg-emerald-50/20 transition-colors duration-150`}
      onClick={onRowClick}
    >
      <td style={{ width: 4, padding: 0, backgroundColor: stripColor }} />

      {/* Bulk select checkbox — only for CONFIRMED orders */}
      {selectable && (
        <td className="pl-3 pr-1 py-4 w-9" onClick={(e) => e.stopPropagation()}>
          {order.status === 'CONFIRMED' && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onToggleSelect}
              className={`h-3.5 w-3.5 rounded accent-emerald-600 cursor-pointer transition-opacity duration-150 ${
                selected || hasAnySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
          )}
        </td>
      )}

      {/* Client + time */}
      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <button
            className="font-medium text-gray-900 leading-tight hover:text-emerald-600 hover:underline text-left transition-colors"
            onClick={() => onClientClick?.(order.customerPhone, order.customerName)}
          >
            {order.customerName}
          </button>
          {order.needsReview && (
            <span
              title="Vérification recommandée - confiance faible"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border bg-yellow-50 text-yellow-700 border-yellow-300 shrink-0"
            >
              <TriangleAlert className="h-3 w-3" /> À vérifier
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 mt-0.5 block">{timeAgo(order.createdAt)}</span>
      </td>

      {/* Phone */}
      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 text-sm">{formatPhone(order.customerPhone)}</span>
          <a
            href={`tel:${order.customerPhone}`}
            className="p-1 rounded-md hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
          {order.customerPhone && (
            <a
              href={`https://wa.me/${order.customerPhone.replace(/\s/g, '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '212')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-md hover:bg-green-50 text-gray-300 hover:text-green-500 transition-colors duration-150"
              onClick={(e) => e.stopPropagation()}
              title="Ouvrir WhatsApp"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
          )}
        </div>
      </td>

      {/* Product */}
      <td className="px-4 py-4 text-gray-700 max-w-[180px]">
        <span className="block truncate">{order.product}</span>
      </td>

      {/* Qty */}
      <td className="px-4 py-4 text-gray-400 text-center text-sm">{order.quantity}</td>

      {/* Prix Produit = price × qty */}
      <td className="px-4 py-4">
        {order.price != null ? (
          <span className="text-sm text-gray-700 font-medium">
            {((order.price) * (order.quantity || 1)).toLocaleString('fr-FR')} DH
          </span>
        ) : (
          <span className="text-xs text-gray-300">— Ajouter</span>
        )}
      </td>

      {/* Address */}
      <td className="px-4 py-4 text-gray-400 hidden lg:table-cell">
        <span className="block truncate max-w-[140px] text-sm">{order.address || '—'}</span>
      </td>

      {/* Delivery date — shows urgency badge when urgent, plain date otherwise */}
      <td className="px-4 py-4 hidden lg:table-cell">
        {urgency ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${urgency.badgeClass}`}>
            <CalendarClock className="h-3 w-3" />
            {urgency.label}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">{order.deliveryDate ? formatDateFr(order.deliveryDate) : '—'}</span>
        )}
      </td>

      {/* Prix Livraison — inline editable */}
      <td className="px-4 py-4 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
        {editingDeliveryId === order.id ? (
          <input
            type="number" min="0" step="1"
            value={editDeliveryValue ?? ''}
            onChange={(e) => onDeliveryEditChange?.(e.target.value)}
            onBlur={() => onDeliveryEditSave?.(order.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onDeliveryEditSave?.(order.id)
              if (e.key === 'Escape') onDeliveryEditCancel?.()
            }}
            className="w-20 h-7 px-2 text-sm border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
            autoFocus
          />
        ) : (
          <button
            onClick={() => onDeliveryEditStart?.(order.id, order.deliveryPrice)}
            className="text-left w-full"
          >
            {order.deliveryPrice === null ? (
              <span className="text-xs text-gray-300 hover:text-emerald-500 transition-colors">— Ajouter</span>
            ) : order.deliveryPrice === 0 ? (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Gratuite 🎁</span>
            ) : (
              <span className="text-sm text-gray-700 font-medium">{order.deliveryPrice.toLocaleString('fr-FR')} DH</span>
            )}
          </button>
        )}
      </td>

      {/* Prix Total = (price × qty) + deliveryPrice */}
      <td className="px-4 py-4 hidden lg:table-cell">
        {(() => {
          const prixProduit = (order.price || 0) * (order.quantity || 1)
          const prixTotal = prixProduit + (order.deliveryPrice || 0)
          return prixTotal > 0 ? (
            <span className="font-bold text-green-600">{prixTotal.toLocaleString('fr-FR')} DH</span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )
        })()}
      </td>

      {/* Status + contextual action buttons */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1.5">
          {(order.status === 'CONFIRMED' || order.status === 'LIVRE') && editable ? (
            <button ref={triggerRef} className="text-left" onClick={() => onToggleStatusExpand?.()}>
              <StatusPill status={order.status} />
            </button>
          ) : (
            <StatusPill status={order.status} />
          )}
          {editable && statusExpanded && (
            <StatusDropdown
              triggerRef={triggerRef}
              showLivre={order.status !== 'LIVRE'}
              showLivreur={order.status === 'CONFIRMED'}
              onLivre={order.status !== 'LIVRE' ? () => { onToggleStatusExpand?.(); onMarkLivre?.() } : undefined}
              onRetourne={() => { onToggleStatusExpand?.(); onMarkRetourne?.() }}
              onLivreur={order.status === 'CONFIRMED' ? () => { onToggleStatusExpand?.(); onSendToLivreur?.() } : undefined}
            />
          )}
          {editable && order.status === 'CONFIRMED' && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={onSendToLivreur}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
              >
                📦 Envoyer livreur
              </button>
              <button
                onClick={onPrintLabel}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                🖨️ Bordereau
              </button>
            </div>
          )}
          {editable && order.status === 'EN_LIVRAISON' && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={onMarkLivre}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
              >
                ✅ Livré
              </button>
              <button
                onClick={onMarkRetourne}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors whitespace-nowrap"
              >
                ↩️ Retourné / Annulé
              </button>
            </div>
          )}
        </div>
      </td>

      {/* Actions (edit + delete) — only in editable sections */}
      {editable && (
        <td className="px-2 py-4 w-16" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={onRowEditStart}
              title="Modifier"
              className="p-1.5 rounded-md text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDeleteRequest}
              title="Supprimer"
              className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}

// ── StatusDropdown ────────────────────────────────────────────────────────────

function StatusDropdown({
  triggerRef,
  showLivre,
  showLivreur,
  onLivre,
  onRetourne,
  onLivreur,
}: {
  triggerRef: { current: HTMLButtonElement | null }
  showLivre: boolean
  showLivreur: boolean
  onLivre?: () => void
  onRetourne: () => void
  onLivreur?: () => void
}) {
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', visibility: 'hidden', zIndex: 9999 })

  useEffect(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const above = window.innerHeight - rect.bottom < 200
    setStyle({
      position: 'fixed',
      left: rect.left,
      minWidth: 200,
      zIndex: 9999,
      ...(above ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    })
  }, [])

  return (
    <div style={style} className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 pb-0.5">
        Changer le statut
      </p>
      {showLivre && (
        <button
          onClick={onLivre}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-left"
        >
          ✅ Livré
        </button>
      )}
      <button
        onClick={onRetourne}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-left"
      >
        ↩️ Retourné
      </button>
      {showLivreur && (
        <button
          onClick={onLivreur}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors text-left"
        >
          🚚 Envoyer livreur
        </button>
      )}
    </div>
  )
}

// ── ReturnReasonModal ─────────────────────────────────────────────────────────

const RETURN_REASONS: { value: string; label: string }[] = [
  { value: 'INJOIGNABLE',            label: 'Injoignable' },
  { value: 'REFUSE_LIVRAISON',       label: 'Refuse la livraison' },
  { value: 'FAUSSE_COMMANDE',        label: 'Fausse commande' },
  { value: 'ANNULE_AVANT_LIVRAISON', label: 'Annulé avant livraison' },
  { value: 'REPORTE_CLIENT',         label: 'Reporté par client' },
  { value: 'MAUVAISE_ADRESSE',       label: 'Mauvaise adresse' },
  { value: 'PROBLEME_PRODUIT',       label: 'Problème produit' },
  { value: 'AUTRE',                  label: 'Autre' },
]

function ReturnReasonModal({
  order,
  onConfirm,
  onClose,
}: {
  order: Order
  onConfirm: (status: 'RETOURNE' | 'ANNULE', reason: string) => void
  onClose: () => void
}) {
  const [status, setStatus] = useState<'RETOURNE' | 'ANNULE'>('RETOURNE')
  const [reason, setReason] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-base">Retour / Annulation</h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500 -mt-1">
          Commande de <span className="font-medium text-gray-800">{order.customerName}</span>
        </p>

        {/* Status toggle */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Type</p>
          <div className="flex gap-2">
            {(['RETOURNE', 'ANNULE'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  status === s
                    ? s === 'RETOURNE'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-gray-500 text-white border-gray-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s === 'RETOURNE' ? '↩️ Retourné' : '✖️ Annulé'}
              </button>
            ))}
          </div>
        </div>

        {/* Reason chips */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Raison <span className="text-red-400">*</span></p>
          <div className="flex flex-wrap gap-1.5">
            {RETURN_REASONS.map(r => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  reason === r.value
                    ? 'bg-red-500 text-white border-red-500'
                    : 'border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => reason && onConfirm(status, reason)}
            disabled={!reason}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── LivreurModal ──────────────────────────────────────────────────────────────

function LivreurModal({ order, onClose, onMarkEnLivraison }: { order: Order; onClose: () => void; onMarkEnLivraison?: () => void }) {
  const saved = localStorage.getItem('livreur_whatsapp') || ''
  const [phone, setPhone] = useState(saved)
  const [remember, setRemember] = useState(true)
  const [sent, setSent] = useState(false)

  const productTotal = order.totalPrice ?? 0
  const dp = order.deliveryPrice ?? 0
  const codTotal = productTotal + dp
  const totalStr = codTotal > 0 ? `${codTotal.toLocaleString('fr-FR')} DH` : '—'

  const handleSend = () => {
    const num = phone.replace(/\s+/g, '')
    if (!num) return
    if (remember) localStorage.setItem('livreur_whatsapp', num)

    const codLine = codTotal > 0
      ? dp > 0
        ? `💰 Montant à encaisser (COD) : ${totalStr}\n   dont ${dp.toLocaleString('fr-FR')} DH frais de livraison`
        : `💰 Montant à encaisser (COD) : ${totalStr}`
      : '💰 Montant à encaisser (COD) : —'

    const msg = [
      'Bonjour, j\'ai une nouvelle commande à livrer :',
      `👤 Client : ${order.customerName}`,
      `📞 Téléphone : ${order.customerPhone || '—'}`,
      `📦 Produit : ${order.product} (x${order.quantity})`,
      `📍 Adresse : ${order.address || '—'}`,
      `🗓️ Date de livraison : ${order.deliveryDate ? formatDateFr(order.deliveryDate) : '—'}`,
      codLine,
      'Merci de confirmer la prise en charge.',
    ].join('\n')

    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
    setSent(true)
    onMarkEnLivraison?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">Envoyer la commande au livreur</p>
            <p className="text-xs text-gray-400 mt-0.5">Via WhatsApp</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Order summary */}
        <div className="px-5 py-4 space-y-2 bg-gray-50/60 mx-4 mt-4 rounded-xl border border-gray-100 text-sm">
          <Row label="Client" value={order.customerName} />
          <Row label="Téléphone" value={order.customerPhone || '—'} />
          <Row label="Produit" value={`${order.product} × ${order.quantity}`} />
          <Row label="Adresse" value={order.address || '—'} />
          <Row label="Livraison" value={order.deliveryDate ? formatDateFr(order.deliveryDate) : '—'} />
          <Row label="Montant COD" value={totalStr} bold green />
          {dp > 0 && <Row label="dont livraison" value={`${dp.toLocaleString('fr-FR')} DH`} />}
        </div>

        {/* Livreur phone */}
        <div className="px-5 pt-4 pb-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Numéro WhatsApp du livreur
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+212 6XX XX XX XX"
            className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Remember checkbox */}
        <div className="px-5 pb-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-emerald-600"
            />
            <span className="text-xs text-gray-500">Mémoriser ce numéro</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          {sent ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <Check className="h-4 w-4" />
                Message ouvert dans WhatsApp
              </div>
              <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 underline">Fermer</button>
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={!phone.trim()}
              className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>📲</span> Envoyer via WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── BulkLivreurModal ─────────────────────────────────────────────────────────

const NUM_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']

function BulkLivreurModal({ orders, onClose, onSent }: { orders: Order[]; onClose: () => void; onSent: () => void }) {
  const saved = localStorage.getItem('livreur_whatsapp') || ''
  const [phone, setPhone] = useState(saved)
  const [remember, setRemember] = useState(true)
  const [sent, setSent] = useState(false)

  const totalCOD = orders.reduce((sum, o) => sum + (o.totalPrice ?? 0) + (o.deliveryPrice ?? 0), 0)
  const totalDelivery = orders.reduce((sum, o) => sum + (o.deliveryPrice ?? 0), 0)

  const buildMessage = () => {
    const lines = ['Bonjour, voici les commandes à livrer :']
    orders.forEach((o, idx) => {
      const num = NUM_EMOJIS[idx] ?? `${idx + 1}.`
      const orderCOD = (o.totalPrice ?? 0) + (o.deliveryPrice ?? 0)
      const codStr = orderCOD > 0 ? `${orderCOD.toLocaleString('fr-FR')} DH` : '—'
      const dpStr = o.deliveryPrice !== null && o.deliveryPrice > 0
        ? ` (dont ${o.deliveryPrice.toLocaleString('fr-FR')} DH liv.)`
        : ''
      lines.push(
        `${num} ${o.customerName} — ${o.customerPhone || '—'}`,
        `📦 ${o.product} x${o.quantity}`,
        `📍 ${o.address || '—'}`,
        `🗓️ ${o.deliveryDate ? formatDateFr(o.deliveryDate) : '—'}`,
        `💰 ${codStr} COD${dpStr}`,
        '',
      )
    })
    lines.push(
      `Total commandes : ${orders.length}`,
      `Total à encaisser : ${totalCOD.toLocaleString('fr-FR')} DH COD`,
      ...(totalDelivery > 0 ? [`dont ${totalDelivery.toLocaleString('fr-FR')} DH frais de livraison`] : []),
      'Merci de confirmer la prise en charge 🙏',
    )
    return lines.join('\n')
  }

  const handleSend = () => {
    const num = phone.replace(/\s+/g, '')
    if (!num) return
    if (remember) localStorage.setItem('livreur_whatsapp', num)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(buildMessage())}`, '_blank')
    setSent(true)
    onSent()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="font-semibold text-gray-900">
              Envoyer {orders.length} commande{orders.length > 1 ? 's' : ''} au livreur
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Via WhatsApp</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Message preview */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Aperçu du message</p>
            <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-3 whitespace-pre-wrap font-sans leading-relaxed">{buildMessage()}</pre>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Numéro WhatsApp du livreur</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6XX XX XX XX"
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Remember */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 rounded accent-emerald-600" />
            <span className="text-xs text-gray-500">Mémoriser ce numéro</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          {sent ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <Check className="h-4 w-4" />
                Message ouvert dans WhatsApp
              </div>
              <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 underline">Fermer</button>
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={!phone.trim()}
              className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>📲</span> Envoyer via WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold, green }: { label: string; value: string; bold?: boolean; green?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`text-right ${bold ? 'font-semibold' : ''} ${green ? 'text-emerald-600' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

// ── LabelPreviewModal ─────────────────────────────────────────────────────────

function LabelPreviewModal({ orders, businessName, onClose }: {
  orders: Order[]
  businessName: string
  onClose: () => void
}) {
  const handleDownload = () => {
    const doc = generateLabels(orders, businessName)
    doc.save(`bordereaux-${orders.length}-commande${orders.length > 1 ? 's' : ''}.pdf`)
  }

  const handlePrint = () => {
    const doc = generateLabels(orders, businessName)
    doc.autoPrint()
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 15000)
  }

  const totalCOD = orders.reduce((s, o) => s + (o.totalPrice ?? 0) + (o.deliveryPrice ?? 0), 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">
              {orders.length === 1 ? 'Bordereau de livraison' : `${orders.length} bordereaux`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {orders.length === 1 ? '1 page · 10 cm × 15 cm' : `${orders.length} pages · 10 cm × 15 cm`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Order list */}
        <div className="px-5 py-3 max-h-52 overflow-y-auto divide-y divide-gray-50">
          {orders.map((o, i) => (
            <div key={o.id} className="flex items-center gap-3 py-2">
              <span className="text-xs text-gray-300 w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{o.customerName}</p>
                <p className="text-xs text-gray-400 truncate">{o.address || '—'}</p>
              </div>
              {o.totalPrice !== null && (
                <span className="text-sm font-semibold text-emerald-600 shrink-0">
                  {o.totalPrice.toLocaleString('fr-FR')} DH
                </span>
              )}
            </div>
          ))}
        </div>

        {/* COD total */}
        {orders.length > 1 && totalCOD > 0 && (
          <div className="mx-5 mb-3 px-3 py-2 bg-emerald-50 rounded-lg flex items-center justify-between">
            <span className="text-xs text-emerald-700 font-medium">Total COD</span>
            <span className="text-sm font-bold text-emerald-700">{totalCOD.toLocaleString('fr-FR')} DH</span>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2.5">
          <button
            onClick={handleDownload}
            className="flex-1 h-9 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Télécharger PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CloturerModal ─────────────────────────────────────────────────────────────

type CloturerDecision = Record<string, 'LIVRE' | 'RETOURNE'>

function CloturerModal({ orders, onClose, onConfirm }: {
  orders: Order[]
  onClose: () => void
  onConfirm: (decisions: CloturerDecision) => void
}) {
  const pending = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'EN_LIVRAISON')
  const [decisions, setDecisions] = useState<CloturerDecision>({})

  const decide = (id: string, status: 'LIVRE' | 'RETOURNE') =>
    setDecisions(prev => ({ ...prev, [id]: status }))

  const validateAll = () => {
    const all: CloturerDecision = {}
    pending.forEach(o => { all[o.id] = decisions[o.id] ?? 'LIVRE' })
    onConfirm(all)
  }

  const decided = Object.keys(decisions).length
  const totalCOD = pending
    .filter(o => (decisions[o.id] ?? null) !== 'RETOURNE')
    .reduce((sum, o) => sum + (o.totalPrice ?? 0) + (o.deliveryPrice ?? 0), 0)

  if (pending.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold text-gray-800">Aucune commande en attente</p>
          <p className="text-sm text-gray-400 mt-1">Toutes les livraisons sont à jour.</p>
          <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm">Fermer</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="font-semibold text-gray-900">Clôturer la journée</p>
            <p className="text-xs text-gray-400 mt-0.5">{pending.length} commande{pending.length > 1 ? 's' : ''} en attente</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        {/* Order list */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {pending.map(o => {
            const d = decisions[o.id]
            const cod = (o.totalPrice ?? 0) + (o.deliveryPrice ?? 0)
            return (
              <div key={o.id} className={`px-4 py-3 transition-colors ${d === 'LIVRE' ? 'bg-emerald-50/50' : d === 'RETOURNE' ? 'bg-red-50/50' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{o.customerName}</p>
                    <p className="text-xs text-gray-400 truncate">{o.product} · {cod > 0 ? `${cod.toLocaleString('fr-FR')} DH` : '—'}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => decide(o.id, 'LIVRE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${d === 'LIVRE' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
                    >
                      ✅ Livré
                    </button>
                    <button
                      onClick={() => decide(o.id, 'RETOURNE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${d === 'RETOURNE' ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                    >
                      ↩️ Retourné
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-3">
          {decided > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{decided}/{pending.length} renseignées</span>
              {totalCOD > 0 && (
                <span className="font-bold text-emerald-600">💰 {totalCOD.toLocaleString('fr-FR')} DH à encaisser</span>
              )}
            </div>
          )}
          <button
            onClick={validateAll}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
          >
            {decided === pending.length ? '✅ Valider les décisions' : `Valider tout comme Livré (${pending.length - decided} restantes)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [period, setPeriod] = useState<Period>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ customerName: '', customerPhone: '', product: '', quantity: '', price: '', address: '', deliveryDate: '', deliveryPrice: '', status: 'CONFIRMED' })
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null)
  const [editDeliveryValue, setEditDeliveryValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('Ma Boutique')
  const [livreurOrder, setLivreurOrder] = useState<Order | null>(null)
  const [labelOrders, setLabelOrders] = useState<Order[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [isFiltering, setIsFiltering] = useState(false)
  const [filterByField, setFilterByField] = useState<'createdAt' | 'deliveryDate'>('createdAt')
  const [cashflow, setCashflow] = useState<Cashflow | null>(null)
  const [displayEncaisse, setDisplayEncaisse] = useState(0)
  const [cloturerOpen, setCloturerOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [returnReasonOrder, setReturnReasonOrder] = useState<Order | null>(null)
  const [expandedStatusId, setExpandedStatusId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsSince, setSecondsSince] = useState(0)
  const refreshAllRef = useRef<() => void>(() => {})
  const cashflowParamsRef = useRef<{ dateFrom?: string; dateTo?: string }>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedClient, setSelectedClient] = useState<{ phone: string; name: string } | null>(null)
  const [vapidPublicKey, setVapidPublicKey] = useState('')
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  // ── Voice order state ────────────────────────────────────────────────────────
  type VoiceStep = 'idle' | 'recording' | 'processing' | 'review' | 'form'
  const [voiceStep, setVoiceStep] = useState<VoiceStep>('idle')
  const [voiceTranscription, setVoiceTranscription] = useState('')
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null)
  const [voiceForm, setVoiceForm] = useState({
    customerName: '', customerPhone: '', product: '', quantity: '1',
    price: '', deliveryPrice: '', address: '', deliveryDate: '',
  })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  if (!user) { navigate('/'); return null }

  useOrderNotifications()
  usePushNotifications(vapidPublicKey)

  const fetchOrders = useCallback(async (searchVal: string, statusVal: string, periodVal: Period) => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      if (statusVal !== 'ALL') q.set('status', statusVal)
      if (searchVal.trim()) q.set('search', searchVal.trim())
      const dateFrom = getPeriodStart(periodVal)
      if (dateFrom) q.set('dateFrom', dateFrom)
      q.set('limit', '500')
      const data = await apiGet(`/api/orders?${q}`)
      setOrders(data.orders || [])
      setLastUpdated(new Date())
    } catch {
      setError('Impossible de charger les commandes. Le serveur est-il démarré ?')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async (periodVal: Period) => {
    try {
      const data = await apiGet(`/api/stats?period=${periodVal}`)
      setStats(data)
    } catch { /* non-critical */ }
  }, [])

  const fetchCashflow = useCallback(async () => {
    try {
      const p = cashflowParamsRef.current
      const q = new URLSearchParams()
      if (p.dateFrom) q.set('dateFrom', p.dateFrom)
      if (p.dateTo) q.set('dateTo', p.dateTo)
      const qs = q.toString()
      const data = await apiGet(`/api/stats/cashflow${qs ? `?${qs}` : ''}`)
      setCashflow(data)
      setDisplayEncaisse(data.caEncaisse)
    } catch { /* non-critical */ }
  }, [])

  const animateCountUp = useCallback((from: number, to: number) => {
    const duration = 700
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayEncaisse(Math.round(from + (to - from) * ease))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  // ── Voice recording helpers ──────────────────────────────────────────────────

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string).split(',')[1])
      reader.readAsDataURL(blob)
    })
  }

  const closeVoice = () => {
    setVoiceStep('idle')
    setVoiceTranscription('')
    setExtractedData(null)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const base64 = await blobToBase64(blob)
        setVoiceStep('processing')
        try {
          const response = await apiPost('/api/orders/voice', { audio: base64, mimeType: 'audio/webm' })
          setVoiceTranscription(response.transcription || '')
          setExtractedData(response)
          setVoiceForm({
            customerName: response.customerName || '',
            customerPhone: response.phone || '',
            product: response.product || '',
            quantity: String(response.quantity || 1),
            price: response.price != null ? String(response.price) : '',
            deliveryPrice: response.deliveryPrice != null ? String(response.deliveryPrice) : '',
            address: response.address || '',
            deliveryDate: response.deliveryDate || '',
          })
          setVoiceStep('review')
        } catch {
          showToast('Erreur lors du traitement vocal', false)
          setVoiceStep('idle')
        }
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setVoiceStep('recording')
    } catch {
      showToast('Microphone inaccessible', false)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  const confirmVoiceOrder = async () => {
    if (!extractedData) return
    try {
      await apiPost('/api/orders', {
        customerName: extractedData.customerName,
        customerPhone: extractedData.phone,
        product: extractedData.product,
        quantity: extractedData.quantity || 1,
        price: extractedData.price,
        deliveryPrice: extractedData.deliveryPrice,
        address: extractedData.address,
        deliveryDate: extractedData.deliveryDate,
      })
      closeVoice()
      showToast('✅ Commande créée !', true)
      fetchOrders(search, statusFilter, period)
      fetchStats(period)
    } catch {
      showToast('Erreur lors de la création', false)
    }
  }

  const editVoiceOrder = () => setVoiceStep('form')

  const submitVoiceOrder = async () => {
    try {
      await apiPost('/api/orders', {
        customerName: voiceForm.customerName,
        customerPhone: voiceForm.customerPhone,
        product: voiceForm.product,
        quantity: parseInt(voiceForm.quantity) || 1,
        price: voiceForm.price ? parseFloat(voiceForm.price) : null,
        deliveryPrice: voiceForm.deliveryPrice ? parseFloat(voiceForm.deliveryPrice) : null,
        address: voiceForm.address,
        deliveryDate: voiceForm.deliveryDate,
      })
      closeVoice()
      showToast('✅ Commande créée !', true)
      fetchOrders(search, statusFilter, period)
      fetchStats(period)
    } catch {
      showToast('Erreur lors de la création', false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchOrders(search, statusFilter, 'all')
    fetchStats('all')
    fetchCashflow()
    apiGet('/api/business/me').then((d) => {
      if (d?.name) setBusinessName(d.name)
      if (d?.vapidPublicKey) setVapidPublicKey(d.vapidPublicKey)
    }).catch(() => {})
  }, [])
  // Close expanded status badge on any outside click
  useEffect(() => {
    const close = () => setExpandedStatusId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // Sync cashflow params ref with active date filters
  useEffect(() => {
    if (isFiltering && (dateFrom || dateTo)) {
      cashflowParamsRef.current = {
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      }
    } else if (period !== 'all') {
      const from = getPeriodStart(period)
      cashflowParamsRef.current = from ? { dateFrom: from } : {}
    } else {
      cashflowParamsRef.current = {}
    }
    fetchCashflow()
  }, [isFiltering, dateFrom, dateTo, period])

  // Period change
  useEffect(() => { fetchOrders(search, statusFilter, period); fetchStats(period) }, [period])
  // Status filter change
  useEffect(() => { fetchOrders(search, statusFilter, period) }, [statusFilter])
  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchOrders(search, statusFilter, period), 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // refreshAll — toujours à jour via ref pour éviter les stale closures dans l'interval
  const refreshAll = useCallback(() => {
    fetchOrders(search, statusFilter, period)
    fetchStats(period)
    fetchCashflow()
  }, [search, statusFilter, period])
  useEffect(() => { refreshAllRef.current = refreshAll }, [refreshAll])

  // Auto-refresh toutes les 30s
  useEffect(() => {
    const id = setInterval(() => refreshAllRef.current(), 30000)
    return () => clearInterval(id)
  }, [])

  // Compteur "il y a X secondes"
  useEffect(() => {
    if (!lastUpdated) return
    setSecondsSince(0)
    const id = setInterval(() => setSecondsSince(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await apiPatch(`/api/orders/${orderId}`, { status: newStatus })
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o))
      if (selectedOrder?.id === orderId) setSelectedOrder((p) => p ? { ...p, status: newStatus as Order['status'] } : null)
      fetchStats(period)
      fetchCashflow()
    } catch { /* could show toast */ }
  }

  const showToast = (msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, ok })
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  const handleSimulated = () => { fetchOrders(search, statusFilter, period); fetchStats(period) }

  const handleMarkLivre = async (order: Order) => {
    const orderCOD = (order.totalPrice ?? 0) + (order.deliveryPrice ?? 0)
    const oldEncaisse = cashflow?.caEncaisse ?? 0

    // Optimistic update
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'LIVRE' as const } : o))
    if (selectedOrder?.id === order.id) setSelectedOrder(p => p ? { ...p, status: 'LIVRE' as const } : null)
    setCashflow(prev => prev ? {
      ...prev,
      caEncaisse: prev.caEncaisse + orderCOD,
      enAttente: Math.max(0, prev.enAttente - orderCOD),
      nbLivrees: prev.nbLivrees + 1,
      aConfirmer: Math.max(0, prev.aConfirmer - 1),
    } : null)

    animateCountUp(oldEncaisse, oldEncaisse + orderCOD)
    try { audioRef.current?.play() } catch { /* audio blocked */ }

    try {
      await apiPatch(`/api/orders/${order.id}/status`, { status: 'LIVRE' })
      fetchStats(period)
    } catch {
      showToast('Erreur lors de la mise à jour', false)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o))
      fetchCashflow()
    }
  }

  const handleMarkRetourne = (order: Order) => {
    setReturnReasonOrder(order)
  }

  const handleConfirmRetour = async (order: Order, status: 'RETOURNE' | 'ANNULE', reason: string) => {
    setReturnReasonOrder(null)
    const orderCOD = (order.totalPrice ?? 0) + (order.deliveryPrice ?? 0)

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: status as Order['status'] } : o))
    if (selectedOrder?.id === order.id) setSelectedOrder(p => p ? { ...p, status: status as Order['status'] } : null)
    setCashflow(prev => prev ? {
      ...prev,
      enAttente: Math.max(0, prev.enAttente - orderCOD),
      aConfirmer: Math.max(0, prev.aConfirmer - 1),
    } : null)

    try {
      await apiPatch(`/api/orders/${order.id}/status`, { status, returnReason: reason })
      fetchStats(period)
    } catch {
      showToast('Erreur lors de la mise à jour', false)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o))
      fetchCashflow()
    }
  }

  const handleBatchUpdate = async (decisions: Record<string, 'LIVRE' | 'RETOURNE'>) => {
    setCloturerOpen(false)
    const updates = Object.entries(decisions).map(([orderId, status]) => ({ orderId, status }))
    if (updates.length === 0) return

    const livrées = updates.filter(u => u.status === 'LIVRE')
    const livreeCOD = livrées.reduce((sum, u) => {
      const o = orders.find(x => x.id === u.orderId)
      return sum + (o ? (o.totalPrice ?? 0) + (o.deliveryPrice ?? 0) : 0)
    }, 0)
    const oldEncaisse = cashflow?.caEncaisse ?? 0

    // Optimistic bulk update
    setOrders(prev => prev.map(o => decisions[o.id] ? { ...o, status: decisions[o.id] as Order['status'] } : o))
    setCashflow(prev => prev ? {
      ...prev,
      caEncaisse: prev.caEncaisse + livreeCOD,
      enAttente: Math.max(0, prev.enAttente - livreeCOD),
      nbLivrees: prev.nbLivrees + livrées.length,
      aConfirmer: Math.max(0, prev.aConfirmer - updates.length),
    } : null)

    if (livreeCOD > 0) {
      animateCountUp(oldEncaisse, oldEncaisse + livreeCOD)
      try { audioRef.current?.play() } catch { /* blocked */ }
    }

    try {
      await apiPost('/api/orders/batch-status', { updates })
      fetchStats(period)
      showToast(`✅ ${livrées.length} livraison${livrées.length > 1 ? 's' : ''} confirmée${livrées.length > 1 ? 's' : ''}`, true)
    } catch {
      showToast('Erreur lors de la mise à jour groupée', false)
      fetchOrders(search, statusFilter, period)
      fetchCashflow()
    }
  }

  const startEdit = (order: Order) => {
    setEditingOrderId(order.id)
    setConfirmDeleteId(null)
    setEditDraft({
      customerName: order.customerName,
      customerPhone: order.customerPhone || '',
      product: order.product,
      quantity: String(order.quantity),
      price: order.price !== null ? String(order.price) : '',
      address: order.address || '',
      deliveryDate: order.deliveryDate || '',
      deliveryPrice: order.deliveryPrice !== null ? String(order.deliveryPrice) : '',
      status: order.status,
    })
  }

  const saveEdit = async (orderId: string) => {
    try {
      const updated = await apiPatch(`/api/orders/${orderId}`, {
        customerName: editDraft.customerName,
        customerPhone: editDraft.customerPhone,
        product: editDraft.product,
        quantity: editDraft.quantity === '' ? undefined : parseInt(editDraft.quantity),
        price: editDraft.price === '' ? null : parseFloat(editDraft.price),
        address: editDraft.address,
        deliveryDate: editDraft.deliveryDate,
        deliveryPrice: editDraft.deliveryPrice === '' ? null : parseFloat(editDraft.deliveryPrice),
        status: editDraft.status,
      }) as Order
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o))
      setEditingOrderId(null)
      showToast('Commande mise à jour', true)
    } catch {
      showToast('Erreur lors de la mise à jour', false)
    }
  }

  const saveDeliveryPrice = async (orderId: string) => {
    const dp = editDeliveryValue === '' ? null : parseFloat(editDeliveryValue)
    if (dp !== null && (isNaN(dp) || dp < 0)) { setEditingDeliveryId(null); return }
    setEditingDeliveryId(null)
    try {
      const updated = await apiPatch(`/api/orders/${orderId}`, { deliveryPrice: dp }) as Order
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deliveryPrice: updated.deliveryPrice } : o))
    } catch { /* silent */ }
  }

  const deleteOrder = async (orderId: string) => {
    try {
      await apiDelete(`/api/orders/${orderId}`)
      setOrders(prev => prev.filter(o => o.id !== orderId))
      setConfirmDeleteId(null)
      showToast('Commande supprimée', true)
      fetchStats(period)
    } catch {
      showToast('Erreur lors de la suppression', false)
    }
  }

  // ── Date filter helpers ──────────────────────────────────────────────────────

  const applyDateFilter = () => {
    if (!dateFrom && !dateTo) return
    setIsFiltering(true)
  }

  const resetDateFilter = () => {
    setDateFrom('')
    setDateTo('')
    setIsFiltering(false)
  }

  const applyQuickFilter = (days: number | string) => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    if (days === 0) {
      setDateFrom(todayStr)
      setDateTo(todayStr)
    } else if (days === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      setDateFrom(firstDay.toISOString().split('T')[0])
      setDateTo(todayStr)
    } else {
      const from = new Date()
      from.setDate(from.getDate() - (days as number))
      setDateFrom(from.toISOString().split('T')[0])
      setDateTo(todayStr)
    }
    setIsFiltering(true)
  }

  const filteredOrders = useMemo(() => {
    if (!isFiltering) return orders
    return orders.filter((o) => {
      if (filterByField === 'createdAt') {
        const orderDate = new Date(o.createdAt)
        orderDate.setHours(0, 0, 0, 0)
        if (dateFrom) {
          const from = new Date(dateFrom)
          from.setHours(0, 0, 0, 0)
          if (orderDate < from) return false
        }
        if (dateTo) {
          const to = new Date(dateTo)
          to.setHours(23, 59, 59, 999)
          if (orderDate > to) return false
        }
        return true
      } else {
        const parsed = parseDeliveryDate(o.deliveryDate || '')
        if (!parsed) return true
        if (dateFrom) {
          const from = new Date(dateFrom)
          from.setHours(0, 0, 0, 0)
          if (parsed < from) return false
        }
        if (dateTo) {
          const to = new Date(dateTo)
          to.setHours(23, 59, 59, 999)
          if (parsed > to) return false
        }
        return true
      }
    })
  }, [orders, isFiltering, filterByField, dateFrom, dateTo])

  // ── Derive sections ─────────────────────────────────────────────────────────

  const urgentOrders = filteredOrders
    .filter((o) => getDeliveryUrgency(o.deliveryDate) !== null)
    .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime())

  const regularOrders = filteredOrders

  const rowProps = {
    onStatusChange: handleStatusChange,
    editingDeliveryId,
    editDeliveryValue,
    onDeliveryEditStart: (id: string, price: number | null) => { setEditingDeliveryId(id); setEditDeliveryValue(price !== null ? String(price) : '') },
    onDeliveryEditChange: (v: string) => setEditDeliveryValue(v),
    onDeliveryEditSave: saveDeliveryPrice,
    onDeliveryEditCancel: () => setEditingDeliveryId(null),
  }

  // ── Bulk selection ────────────────────────────────────────────────────────────
  const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED')
  const selectedOrders = orders.filter(o => selectedIds.has(o.id))
  const hasAnySelected = selectedIds.size > 0
  const allConfirmedSelected = confirmedOrders.length > 0 && confirmedOrders.every(o => selectedIds.has(o.id))
  const someConfirmedSelected = confirmedOrders.some(o => selectedIds.has(o.id))

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const selectAll = () => {
    if (allConfirmedSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(confirmedOrders.map(o => o.id)))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <PlanBanner />
      {/* Hidden audio element for cha-ching */}
      <audio ref={audioRef} src="/sounds/cha-ching.mp3" preload="auto" />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gérez vos commandes WhatsApp</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCloturerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border bg-white text-gray-700 border-gray-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all"
              title="Clôturer la journée"
            >
              🌙 <span className="hidden sm:inline">Clôturer</span>
            </button>
            {showSimulator && <SimulatorModal onOrderCreated={handleSimulated} />}
            {typeof Notification !== 'undefined' && (
              notifPermission === 'granted' ? (
                <button
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border bg-white text-green-600 border-green-200"
                  title="Notifications activées"
                  disabled
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notifs ON</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const perm = await Notification.requestPermission()
                    setNotifPermission(perm)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border bg-white text-gray-400 border-gray-200 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 transition-all"
                  title="Activer les notifications"
                >
                  <BellOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Notifications</span>
                </button>
              )
            )}
            <button
              onClick={voiceStep === 'recording' ? stopRecording : voiceStep === 'idle' ? startRecording : undefined}
              disabled={voiceStep === 'processing'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                voiceStep === 'recording'
                  ? 'bg-red-500 text-white border-red-500 animate-pulse'
                  : voiceStep === 'processing'
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {voiceStep === 'recording' ? '🔴 Arrêter' : voiceStep === 'processing' ? '⏳ Analyse...' : '🎤 Commande vocale'}
            </button>
          </div>
        </div>

        {/* ── Period filter + KPI cards ── */}
        <div className="space-y-3">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1.5 w-fit shadow-sm">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  period === opt.value
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total commandes"
              value={stats?.totalOrders}
              icon={Package}
              subtext={stats ? `${stats.ordersThisWeek} cette semaine` : undefined}
              borderClass={KPI_BORDER.total}
              iconBg="bg-gray-100"
              iconColor="text-gray-500"
            />
            <StatCard
              label="À vérifier"
              value={stats?.needsReviewCount ?? 0}
              icon={TriangleAlert}
              subtext="infos manquantes à compléter"
              borderClass={KPI_BORDER.needsReview}
              iconBg="bg-yellow-50"
              iconColor="text-yellow-500"
            />
            <StatCard
              label="Confirmées"
              value={stats?.statusBreakdown?.CONFIRMED ?? 0}
              icon={CheckCircle}
              subtext="prêtes pour livraison"
              borderClass={KPI_BORDER.confirmed}
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
            />
            <StatCard
              label="Livrées"
              value={stats?.statusBreakdown?.DELIVERED ?? 0}
              icon={Truck}
              subtext="commandes finalisées"
              borderClass={KPI_BORDER.delivered}
              iconBg="bg-emerald-950/10"
              iconColor="text-emerald-900"
            />
          </div>
        </div>

        {/* ── Date range filter ── */}
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {([
              { label: "Aujourd'hui", days: 0 },
              { label: '7 derniers jours', days: 7 },
              { label: '30 derniers jours', days: 30 },
              { label: 'Ce mois', days: 'month' },
            ] as { label: string; days: number | string }[]).map(({ label, days }) => (
              <button
                key={label}
                onClick={() => applyQuickFilter(days)}
                className="text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 px-2 py-1 rounded-md transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setFilterByField('createdAt')}
                className={filterByField === 'createdAt'
                  ? 'bg-green-100 text-green-700 px-2 py-1 rounded'
                  : 'text-gray-500 px-2 py-1 rounded hover:bg-gray-100'}
              >
                Date commande
              </button>
              <button
                onClick={() => setFilterByField('deliveryDate')}
                className={filterByField === 'deliveryDate'
                  ? 'bg-green-100 text-green-700 px-2 py-1 rounded'
                  : 'text-gray-500 px-2 py-1 rounded hover:bg-gray-100'}
              >
                Date livraison
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
              <span className="text-gray-400 text-sm">📅 Du</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm text-gray-700 border-none outline-none bg-transparent"
              />
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
              <span className="text-gray-400 text-sm">📅 Au</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm text-gray-700 border-none outline-none bg-transparent"
              />
            </div>

            <button
              onClick={applyDateFilter}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Filtrer
            </button>

            {isFiltering && (
              <button
                onClick={resetDateFilter}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 text-sm"
              >
                ✕ Réinitialiser
              </button>
            )}

            {isFiltering && (
              <span className="text-sm text-green-600 font-medium">
                {filteredOrders.length} commande{filteredOrders.length !== 1 ? 's' : ''} trouvée{filteredOrders.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Search + status filter pills ── */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Rechercher client, produit, téléphone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-white border-gray-200 shadow-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                  statusFilter === f.value
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            {!loading && orders.length > 0 && (
              <span className="ml-auto text-xs text-gray-400 tabular-nums">
                {orders.length} commande{orders.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Cashflow KPI cards ── */}
        <div className="grid grid-cols-2 gap-4">
          {/* CA Encaissé */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 shadow-lg text-white">
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">💰 CA Encaissé</p>
            <p className="text-3xl font-bold mt-2 tabular-nums">
              {cashflow === null
                ? <span className="inline-block w-24 h-8 bg-emerald-400/40 rounded animate-pulse" />
                : <>{displayEncaisse.toLocaleString('fr-FR')} DH</>}
            </p>
            <p className="text-emerald-200 text-xs mt-1.5">
              {cashflow?.nbLivrees ?? 0} commande{(cashflow?.nbLivrees ?? 0) !== 1 ? 's' : ''} livrée{(cashflow?.nbLivrees ?? 0) !== 1 ? 's' : ''}
              {(cashflow?.tauxLivraison ?? 0) > 0 && ` · ${cashflow!.tauxLivraison}% taux`}
            </p>
          </div>

          {/* CA En Attente — cliquable */}
          <button
            className="bg-white border-2 border-amber-200 rounded-2xl p-5 shadow-sm text-left hover:border-amber-300 hover:shadow-md transition-all"
            onClick={() => setCloturerOpen(true)}
            title="Cliquer pour clôturer la journée"
          >
            <p className="text-amber-600 text-xs font-semibold uppercase tracking-wider">⏳ En Attente</p>
            <p className="text-3xl font-bold mt-2 text-gray-900 tabular-nums">
              {cashflow === null
                ? <span className="inline-block w-24 h-8 bg-gray-100 rounded animate-pulse" />
                : <>{(cashflow.enAttente ?? 0).toLocaleString('fr-FR')} DH</>}
            </p>
            <p className="text-amber-500 text-xs mt-1.5 animate-pulse">
              {cashflow?.aConfirmer ?? 0} commande{(cashflow?.aConfirmer ?? 0) !== 1 ? 's' : ''} à confirmer →
            </p>
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Mobile cards ── */}
        <div className="md:hidden space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2.5 animate-pulse shadow-sm">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-5 bg-gray-100 rounded w-20" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-48" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            ))
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <EmptyState search={search} statusFilter={statusFilter} onSimulated={handleSimulated} />
            </div>
          ) : (
            <>
              {/* Regular orders section */}
              {regularOrders.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm">📋</span>
                    <span className="text-xs font-semibold text-gray-600">Toutes les commandes</span>
                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {regularOrders.length}
                    </span>
                  </div>
                  {regularOrders.map((o) => (
                    <OrderCard key={o.id} order={o} onClick={() => setSelectedOrder(o)} />
                  ))}
                </div>
              )}

              {/* Urgent deliveries section — bottom */}
              <div className="space-y-2">
                <div className="h-0.5 bg-gradient-to-r from-red-400 via-amber-400 to-red-400 rounded-full mx-1" />
                <div className="px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🚨</span>
                    <span className="text-xs font-bold text-red-700">Livraisons Proches</span>
                    <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200">
                      {urgentOrders.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 ml-5">Ces commandes apparaissent aussi dans la liste complète ci-dessus</p>
                </div>
                {urgentOrders.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-3 bg-green-50 border border-green-100 rounded-xl mx-1">
                    <span className="text-sm">✅</span>
                    <span className="text-xs text-green-700 font-medium">Aucune livraison urgente dans les 3 prochains jours</span>
                  </div>
                ) : (
                  urgentOrders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      urgency={getDeliveryUrgency(o.deliveryDate)}
                      onClick={() => setSelectedOrder(o)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden md:block">
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <TableHead showActions />
                <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
              </table>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <EmptyState search={search} statusFilter={statusFilter} onSimulated={handleSimulated} />
            </div>
          ) : (
            <>
              {/* ── Section 1: Toutes les commandes ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-600">
                    📋 Toutes les commandes
                    <span className="ml-1.5 text-xs font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {regularOrders.length}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    {lastUpdated && (
                      <span className="text-xs text-gray-400">
                        Mis à jour il y a {secondsSince < 60 ? `${secondsSince}s` : `${Math.floor(secondsSince / 60)}m`}
                      </span>
                    )}
                    <button
                      onClick={refreshAll}
                      title="Actualiser"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Actualiser
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <TableHead
                        showActions
                        selectable
                        allSelected={allConfirmedSelected}
                        someSelected={someConfirmedSelected}
                        onSelectAll={selectAll}
                      />
                      <tbody>
                        {regularOrders.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-400">
                              Aucune commande
                            </td>
                          </tr>
                        ) : (
                          regularOrders.map((order, i) => {
                            const stripColor = STATUS_STRIP_COLOR[order.status]
                            if (order.id === confirmDeleteId) {
                              return (
                                <DeleteConfirmRow
                                  key={order.id}
                                  order={order}
                                  stripColor={stripColor}
                                  onConfirm={() => deleteOrder(order.id)}
                                  onCancel={() => setConfirmDeleteId(null)}
                                />
                              )
                            }
                            if (order.id === editingOrderId) {
                              return (
                                <EditRowInline
                                  key={order.id}
                                  draft={editDraft}
                                  onChange={(field, value) => setEditDraft(prev => ({ ...prev, [field]: value }))}
                                  onSave={() => saveEdit(order.id)}
                                  onCancel={() => setEditingOrderId(null)}
                                  hasCheckbox
                                />
                              )
                            }
                            return (
                              <OrderRow
                                key={order.id}
                                order={order}
                                index={i}
                                stripColor={stripColor}
                                onRowClick={() => setSelectedOrder(order)}
                                editable
                                selectable
                                selected={selectedIds.has(order.id)}
                                hasAnySelected={hasAnySelected}
                                onToggleSelect={() => toggleSelect(order.id)}
                                onRowEditStart={() => startEdit(order)}
                                onDeleteRequest={() => setConfirmDeleteId(order.id)}
                                onSendToLivreur={() => setLivreurOrder(order)}
                                onPrintLabel={() => setLabelOrders([order])}
                                onClientClick={(phone, name) => setSelectedClient({ phone, name })}
                                onMarkLivre={() => handleMarkLivre(order)}
                                onMarkRetourne={() => handleMarkRetourne(order)}
                                statusExpanded={expandedStatusId === order.id}
                                onToggleStatusExpand={() => setExpandedStatusId(id => id === order.id ? null : order.id)}
                                {...rowProps}
                              />
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="py-6">
                <div className="h-px bg-gray-200" />
              </div>

              {/* ── Section 2: Livraisons Proches ── */}
              <div>
                <div className="mb-3">
                  <p className="text-sm font-semibold text-red-700">
                    🚨 Livraisons Proches
                    <span className="ml-1.5 text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
                      {urgentOrders.length}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Ces commandes apparaissent aussi dans la liste complète ci-dessus</p>
                </div>
                {urgentOrders.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-4 bg-green-50 border border-green-100 rounded-xl">
                    <span className="text-base">✅</span>
                    <span className="text-sm text-green-700 font-medium">Aucune livraison urgente dans les 3 prochains jours</span>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <TableHead selectable />
                        <tbody>
                          {urgentOrders.map((order, i) => {
                            const urgency = getDeliveryUrgency(order.deliveryDate)
                            return (
                              <OrderRow
                                key={order.id}
                                order={order}
                                index={i}
                                stripColor={urgency?.stripColor ?? STATUS_STRIP_COLOR[order.status]}
                                urgency={urgency}
                                onRowClick={() => setSelectedOrder(order)}
                                selectable
                                selected={selectedIds.has(order.id)}
                                hasAnySelected={hasAnySelected}
                                onToggleSelect={() => toggleSelect(order.id)}
                                onClientClick={(phone, name) => setSelectedClient({ phone, name })}
                                onMarkLivre={() => handleMarkLivre(order)}
                                onMarkRetourne={() => handleMarkRetourne(order)}
                                statusExpanded={expandedStatusId === order.id}
                                onToggleStatusExpand={() => setExpandedStatusId(id => id === order.id ? null : order.id)}
                                {...rowProps}
                              />
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </main>

      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {livreurOrder && (
        <LivreurModal
          order={livreurOrder}
          onClose={() => setLivreurOrder(null)}
          onMarkEnLivraison={() => {
            const o = livreurOrder
            setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'EN_LIVRAISON' as const } : x))
            apiPatch(`/api/orders/${o.id}/status`, { status: 'EN_LIVRAISON' }).catch(() => {})
          }}
        />
      )}

      {returnReasonOrder && (
        <ReturnReasonModal
          order={returnReasonOrder}
          onConfirm={(status, reason) => handleConfirmRetour(returnReasonOrder, status, reason)}
          onClose={() => setReturnReasonOrder(null)}
        />
      )}

      {labelOrders && (
        <LabelPreviewModal
          orders={labelOrders}
          businessName={businessName}
          onClose={() => setLabelOrders(null)}
        />
      )}

      {bulkModalOpen && selectedOrders.length > 0 && (
        <BulkLivreurModal
          orders={selectedOrders}
          onClose={() => setBulkModalOpen(false)}
          onSent={() => {
            setSelectedIds(new Set())
            setBulkModalOpen(false)
            showToast(`✅ ${selectedOrders.length} commande${selectedOrders.length > 1 ? 's' : ''} envoyée${selectedOrders.length > 1 ? 's' : ''} au livreur`, true)
          }}
        />
      )}

      {/* Bulk action bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out ${hasAnySelected ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between shadow-2xl">
          <span className="text-sm font-medium">
            📦 {selectedIds.size} commande{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-emerald-200 hover:text-white text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => setLabelOrders(selectedOrders)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              🖨️ {selectedIds.size > 1 ? `${selectedIds.size} bordereaux` : 'Bordereau'}
            </button>
            <button
              onClick={() => setBulkModalOpen(true)}
              className="bg-white text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors whitespace-nowrap"
            >
              Envoyer au livreur
            </button>
          </div>
        </div>
      </div>

      {selectedClient && (
        <ClientHistoryDrawer
          phone={selectedClient.phone}
          name={selectedClient.name}
          onClose={() => setSelectedClient(null)}
        />
      )}

      {cloturerOpen && (
        <CloturerModal
          orders={orders}
          onClose={() => setCloturerOpen(false)}
          onConfirm={handleBatchUpdate}
        />
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all animate-in fade-in slide-in-from-bottom-2 ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.ok ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── Voice modals ── */}
      {(voiceStep === 'review' || voiceStep === 'form') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">

            {/* ── Review step ── */}
            {voiceStep === 'review' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">🎤 Transcription vocale</h2>
                  <button onClick={closeVoice} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Transcription box */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">📝 Ce que vous avez dit :</p>
                  <p className="text-sm text-gray-600 italic leading-relaxed">"{voiceTranscription}"</p>
                </div>

                {/* Extracted data box */}
                <div className="bg-white border border-emerald-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">✅ Données extraites :</p>
                  {([
                    ['👤 Client', extractedData?.customerName],
                    ['📦 Produit', extractedData?.product],
                    ['💰 Prix', extractedData?.price != null ? `${extractedData.price} DH` : null],
                    ['🚚 Livraison', extractedData?.deliveryPrice != null ? `${extractedData.deliveryPrice} DH` : null],
                    ['📍 Adresse', extractedData?.address],
                    ['🗓️ Date', extractedData?.deliveryDate],
                    ['📞 Téléphone', extractedData?.phone],
                  ] as [string, unknown][]).map(([label, value]) => (
                    <div key={label} className="flex items-baseline gap-2 text-sm">
                      <span className="text-gray-500 shrink-0">{label} :</span>
                      {value ? (
                        <span className="text-gray-800 font-medium">{String(value)}</span>
                      ) : (
                        <span className="text-orange-400 text-xs">— Non détecté</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={editVoiceOrder}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={confirmVoiceOrder}
                    disabled={!extractedData?.customerName || !extractedData?.product}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    ✅ Confirmer et créer
                  </button>
                </div>
              </>
            )}

            {/* ── Edit form step ── */}
            {voiceStep === 'form' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">Nouvelle commande</h2>
                  <button onClick={closeVoice} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {voiceTranscription && (
                  <p className="text-xs text-gray-400 italic bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    📝 {voiceTranscription}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['customerName', 'Nom client'],
                    ['customerPhone', 'Téléphone'],
                    ['product', 'Produit'],
                    ['quantity', 'Quantité'],
                    ['price', 'Prix produit (DH)'],
                    ['deliveryPrice', 'Frais livraison (DH)'],
                    ['address', 'Adresse'],
                    ['deliveryDate', 'Date livraison'],
                  ] as [keyof typeof voiceForm, string][]).map(([field, label]) => (
                    <div key={field} className={field === 'address' || field === 'product' ? 'col-span-2' : ''}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                      <input
                        type={['quantity', 'price', 'deliveryPrice'].includes(field) ? 'number' : 'text'}
                        value={voiceForm[field]}
                        onChange={e => setVoiceForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setVoiceStep('review')}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    ← Retour
                  </button>
                  <button
                    onClick={submitVoiceOrder}
                    disabled={!voiceForm.customerName || !voiceForm.product}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    Créer la commande
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
