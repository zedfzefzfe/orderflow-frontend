import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet, apiPost, apiPut, apiDelete, apiDownload } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, CheckCircle, XCircle,
  AlertTriangle, Trash2, Pencil, Plus, Download, Package, AlertCircle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Summary {
  totalCount: number
  confirmedCount: number
  cancelledCount: number
  realRevenue: number
  estimatedRevenue: number
  avgOrderValue: number
  confirmationRate: number
  cancellationRate: number
  atRiskCount: number
  revenueEvolution: number | null
  avgEvolution: number | null
}

interface StatusItem { status: string; count: number; percent: number }
interface RevenueDay { date: string; revenue: number }
interface ComparisonDay { day: number; thisMonth: number; lastMonth: number }
interface WeeklyRate { week: string; rate: number; total: number }
interface TopProduct { product: string; count: number; revenue: number; revenuePercent: number }
interface TopClient { name: string; phone: string; count: number; revenue: number; lastOrder: string; city: string }
interface CatalogItem { id: string; name: string; price: number }

type Period = 1 | 7 | 30 | 90

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND = '#16a34a'
const BRAND_DARK = '#166534'
const BRAND_LIGHT = '#86efac'

const DONUT_COLORS: Record<string, string> = {
  CONFIRMED: '#3b82f6',
  DELIVERED: '#16a34a',
  CANCELLED: '#ef4444',
}
const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmé',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
}

const PERIOD_LABELS: Record<Period, string> = {
  1: "Aujourd'hui",
  7: '7 jours',
  30: '30 jours',
  90: '3 mois',
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2 text-sm text-gray-400">
      <Package className="h-8 w-8 text-gray-300" />
      {message}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{children}</h2>
}

function EvoBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>
  const pos = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{value}% vs période préc.
    </span>
  )
}

interface KpiCardProps {
  label: string
  value: string | number
  sub?: React.ReactNode
  icon: React.ElementType
  iconColor: string
  bgColor: string
  loading?: boolean
  urgent?: boolean
}

function KpiCard({ label, value, sub, icon: Icon, iconColor, bgColor, loading, urgent }: KpiCardProps) {
  if (loading) return <Skeleton className="h-28" />
  return (
    <div className={`bg-white rounded-xl border p-4 flex flex-col gap-2 ${urgent ? 'border-orange-300 bg-orange-50/30' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub !== undefined && <div className="text-xs text-gray-400 leading-tight">{sub}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [period, setPeriod] = useState<Period>(30)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [statusBreakdown, setStatusBreakdown] = useState<StatusItem[]>([])
  const [revenueByDay, setRevenueByDay] = useState<RevenueDay[]>([])
  const [comparison, setComparison] = useState<ComparisonDay[]>([])
  const [weeklyRates, setWeeklyRates] = useState<WeeklyRate[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [topClients, setTopClients] = useState<TopClient[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [error, setError] = useState(false)

  // Catalog form state
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [catalogError, setCatalogError] = useState('')

  // Export state
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [exportMonth, setExportMonth] = useState(currentMonth)
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null)

  if (!user) { navigate('/login'); return null }

  const fetchAnalytics = useCallback(async (p: Period) => {
    setLoading(true)
    setError(false)
    try {
      const [s, sb, rd, comp, wr, tp, tc] = await Promise.all([
        apiGet(`/api/analytics/summary?period=${p}`),
        apiGet(`/api/analytics/status-breakdown?period=${p}`),
        apiGet(`/api/analytics/revenue-by-day?period=${p}`),
        apiGet('/api/analytics/orders-comparison'),
        apiGet('/api/analytics/weekly-rates'),
        apiGet(`/api/analytics/top-products?period=${p}&limit=10`),
        apiGet(`/api/analytics/top-clients?period=${p}&limit=10`),
      ])
      setSummary(s)
      setStatusBreakdown(sb)
      setRevenueByDay(rd)
      setComparison(comp)
      setWeeklyRates(wr)
      setTopProducts(tp)
      setTopClients(tc)
    } catch (e) {
      console.error('Analytics fetch error:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    try {
      setCatalog(await apiGet('/api/catalog'))
    } catch (e) {
      console.error('Catalog fetch error:', e)
    } finally {
      setLoadingCatalog(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics(30)
    fetchCatalog()
  }, [])

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    fetchAnalytics(p)
  }

  // ── Catalog actions ──────────────────────────────────────────────────────────

  async function handleAddProduct() {
    setCatalogError('')
    const price = parseFloat(newPrice)
    if (!newName.trim() || isNaN(price) || price < 0) {
      setCatalogError('Nom et prix valides requis.')
      return
    }
    try {
      await apiPost('/api/catalog', { name: newName.trim(), price })
      setNewName(''); setNewPrice('')
      fetchCatalog()
    } catch { setCatalogError("Erreur lors de l'ajout.") }
  }

  async function handleUpdatePrice(id: string) {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price < 0) return
    try {
      await apiPut(`/api/catalog/${id}`, { price })
      setEditingId(null); setEditPrice('')
      fetchCatalog()
    } catch { setCatalogError('Erreur lors de la mise à jour.') }
  }

  async function handleDeleteProduct(id: string) {
    try {
      await apiDelete(`/api/catalog/${id}`)
      fetchCatalog()
    } catch { setCatalogError('Erreur lors de la suppression.') }
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async function handleExport(format: 'csv' | 'xlsx') {
    setExporting(format)
    try {
      const monthLabel = new Date(exportMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      const filename = `commandes_${monthLabel.replace(' ', '_')}.${format}`
      await apiDownload(`/api/orders/export?month=${exportMonth}&format=${format}`, filename)
    } catch (e) {
      console.error('Export error:', e)
    } finally {
      setExporting(null)
    }
  }

  // ── Formatters ───────────────────────────────────────────────────────────────

  const fmtDH = (v: number) => `${v.toLocaleString('fr-FR')} DH`
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }
  const xAxisInterval = period === 1 ? 0 : period === 7 ? 0 : period === 30 ? 4 : 9

  // ── Alerts ───────────────────────────────────────────────────────────────────

  const alerts: string[] = []
  if (summary) {
    if (summary.atRiskCount > 0) alerts.push(`${summary.atRiskCount} commande${summary.atRiskCount > 1 ? 's' : ''} avec des informations manquantes à vérifier`)
    if (summary.cancellationRate > 30) alerts.push(`Taux d'annulation élevé : ${summary.cancellationRate}%`)
    if (period === 1 && summary.confirmedCount === 0 && summary.totalCount === 0) alerts.push("Aucune commande reçue aujourd'hui")
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* Server error banner */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Impossible de charger les analytics. Le serveur est-il accessible ?
          </div>
        )}

        {/* ── SECTION 1: KPI Cards ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Vue d'ensemble</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="CA Réel / période"
              value={summary ? fmtDH(summary.realRevenue) : '—'}
              sub={<EvoBadge value={summary?.revenueEvolution ?? null} />}
              icon={TrendingUp}
              iconColor="text-emerald-600"
              bgColor="bg-emerald-50"
              loading={loading}
            />
            <KpiCard
              label="CA Estimé / période"
              value={summary ? fmtDH(summary.estimatedRevenue) : '—'}
              sub="si toutes les cmdes confirmées"
              icon={TrendingUp}
              iconColor="text-blue-600"
              bgColor="bg-blue-50"
              loading={loading}
            />
            <KpiCard
              label="Panier Moyen"
              value={summary ? fmtDH(summary.avgOrderValue) : '—'}
              sub={<EvoBadge value={summary?.avgEvolution ?? null} />}
              icon={ShoppingCart}
              iconColor="text-violet-600"
              bgColor="bg-violet-50"
              loading={loading}
            />
            <KpiCard
              label="Taux de Confirmation"
              value={summary ? `${summary.confirmationRate}%` : '—'}
              sub={summary ? `${summary.confirmedCount} confirmées sur ${summary.totalCount}` : ''}
              icon={CheckCircle}
              iconColor="text-emerald-600"
              bgColor="bg-emerald-50"
              loading={loading}
            />
            <KpiCard
              label="Taux d'Annulation"
              value={summary ? `${summary.cancellationRate}%` : '—'}
              sub={summary ? `${summary.cancelledCount} annulées cette période` : ''}
              icon={XCircle}
              iconColor="text-red-500"
              bgColor="bg-red-50"
              loading={loading}
            />
            <KpiCard
              label="À vérifier"
              value={summary ? summary.atRiskCount : '—'}
              sub={<span className={summary && summary.atRiskCount > 0 ? 'text-yellow-600 font-medium' : ''}>infos manquantes à compléter</span>}
              icon={AlertTriangle}
              iconColor={summary && summary.atRiskCount > 0 ? 'text-yellow-500' : 'text-gray-400'}
              bgColor={summary && summary.atRiskCount > 0 ? 'bg-yellow-50' : 'bg-gray-50'}
              loading={loading}
              urgent={!!summary && summary.atRiskCount > 0}
            />
          </div>
        </section>

        {/* ── SECTION 2: Period Filter ─────────────────────────────────────── */}
        <section className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white border rounded-xl p-1.5">
            {([1, 7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  period === p
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {loading && (
            <span className="text-xs text-gray-400 animate-pulse">Chargement…</span>
          )}
        </section>

        {/* ── SECTION 7: Alerts (shown early for visibility) ───────────────── */}
        {!loading && alerts.length > 0 && (
          <section>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-orange-700 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                Alertes business
              </div>
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-orange-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION 3: Charts Row 1 ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* CA par jour — line chart (2/3 width) */}
          <div className="lg:col-span-2 bg-white rounded-xl border p-4 space-y-3">
            <SectionTitle>CA par jour — confirmé + livré</SectionTitle>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : revenueByDay.every((d) => d.revenue === 0) ? (
              <EmptyState message="Aucun revenu sur cette période" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={revenueByDay} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    interval={xAxisInterval}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={(v) => `${v}`}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    formatter={((v: number) => [`${v.toLocaleString('fr-FR')} DH`, 'CA']) as any}
                    labelFormatter={((l: string) => new Date(l + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })) as any}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={BRAND}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: BRAND, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Commandes par statut — donut (1/3 width) */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <SectionTitle>Commandes par statut</SectionTitle>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : statusBreakdown.length === 0 ? (
              <EmptyState message="Aucune commande" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={DONUT_COLORS[entry.status] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={((v: number, name: string) => [v, STATUS_LABELS[name] || name]) as any}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {statusBreakdown.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: DONUT_COLORS[s.status] || '#94a3b8' }} />
                        <span className="text-gray-600">{STATUS_LABELS[s.status] || s.status}</span>
                      </div>
                      <span className="font-medium text-gray-800">{s.count} <span className="text-gray-400 font-normal">({s.percent}%)</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── SECTION 4: Charts Row 2 ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Ce mois vs mois précédent — bar */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <SectionTitle>Ce mois vs mois précédent</SectionTitle>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : comparison.length === 0 ? (
              <EmptyState message="Pas de données de comparaison" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={comparison} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={((v: number, name: string) => [v, name === 'thisMonth' ? 'Ce mois' : 'Mois préc.']) as any}
                    labelFormatter={(l) => `Jour ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Legend
                    formatter={(value) => value === 'thisMonth' ? 'Ce mois' : 'Mois précédent'}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="thisMonth" fill={BRAND} radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="lastMonth" fill={BRAND_LIGHT} radius={[3, 3, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Taux de confirmation par semaine — line */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <SectionTitle>Taux de confirmation par semaine (8 sem.)</SectionTitle>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : weeklyRates.every((w) => w.total === 0) ? (
              <EmptyState message="Pas assez de données" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={weeklyRates} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={((v: number) => [`${v}%`, 'Taux de confirmation']) as any}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={BRAND_DARK}
                    strokeWidth={2.5}
                    dot={{ fill: BRAND_DARK, r: 3, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── SECTION 5: Top Produits ──────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Top produits — par CA généré</SectionTitle>
          <div className="bg-white rounded-xl border overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <EmptyState message="Aucun produit sur cette période" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/60 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8">#</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Produit</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Commandes</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">CA Généré</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right hidden md:table-cell">% du CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.product}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                          {p.count}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {p.revenue > 0 ? fmtDH(p.revenue) : <span className="text-gray-400 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${p.revenuePercent}%` }} />
                          </div>
                          <span className="text-gray-500 text-xs tabular-nums w-8 text-right">{p.revenuePercent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── SECTION 6: Top Clients ───────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Top clients — par CA total</SectionTitle>
          <div className="bg-white rounded-xl border overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : topClients.length === 0 ? (
              <EmptyState message="Aucun client sur cette période" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/60 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Téléphone</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Nb Cmdes</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">CA Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Dernière cmde</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Ville</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topClients.map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">{c.phone}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">
                          {c.count}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {c.revenue > 0 ? fmtDH(c.revenue) : <span className="text-gray-400 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                        {c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm hidden lg:table-cell">
                        {c.city || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Catalogue produits ───────────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Catalogue produits</SectionTitle>
          <p className="text-xs text-gray-400">
            Les prix du catalogue sont utilisés pour calculer le CA estimé automatiquement lors de chaque commande.
          </p>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Nom du produit"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 min-w-[160px] bg-white h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
                />
                <Input
                  placeholder="Prix (DH)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-28 bg-white h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
                />
                <Button size="sm" onClick={handleAddProduct} className="bg-emerald-600 hover:bg-emerald-700 h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> Ajouter
                </Button>
              </div>
              {catalogError && <p className="text-xs text-red-500 mt-1">{catalogError}</p>}
            </div>
            {loadingCatalog ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : catalog.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Aucun produit dans le catalogue.<br />
                <span className="text-xs">Ajoutez un produit pour activer le calcul automatique du CA.</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Produit</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Prix (DH)</th>
                    <th className="px-4 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {catalog.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 text-gray-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {editingId === item.id ? (
                          <div className="flex gap-1.5 items-center">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-24 h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdatePrice(item.id)}
                            />
                            <Button size="sm" onClick={() => handleUpdatePrice(item.id)} className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-xs">OK</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 px-2 text-xs">✕</Button>
                          </div>
                        ) : (
                          `${item.price.toLocaleString('fr-FR')} DH`
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-emerald-600"
                            onClick={() => { setEditingId(item.id); setEditPrice(String(item.price)) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                            onClick={() => handleDeleteProduct(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Export ──────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Exporter les commandes</SectionTitle>
          <div className="bg-white rounded-xl border p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">Mois</label>
              <Input
                type="month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="h-8 text-sm w-40"
              />
            </div>
            <Button
              size="sm" variant="outline"
              disabled={exporting === 'csv'}
              onClick={() => handleExport('csv')}
              className="h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'csv' ? 'Génération…' : 'Exporter CSV'}
            </Button>
            <Button
              size="sm"
              disabled={exporting === 'xlsx'}
              onClick={() => handleExport('xlsx')}
              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'xlsx' ? 'Génération…' : 'Exporter Excel'}
            </Button>
          </div>
        </section>

      </main>
    </div>
  )
}
