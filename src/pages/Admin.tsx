import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet, apiPatch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LogOut, Package, TrendingUp, Building2 } from 'lucide-react'

interface Business {
  id: string
  name: string
  email: string
  plan: string
  orderCount: number
  trialEndsAt: string | null
  createdAt: string
}

interface MRR {
  mrr: number
  currency: string
  breakdown: Record<string, number>
}

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-100 text-blue-700',
  growth: 'bg-emerald-100 text-emerald-700',
  pro: 'bg-purple-100 text-purple-700',
}

const PLAN_PRICES: Record<string, number> = {
  trial: 0,
  starter: 299,
  growth: 599,
  pro: 999,
}

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [mrr, setMrr] = useState<MRR | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    fetchData()
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [bizData, mrrData] = await Promise.all([
        apiGet('/api/admin/businesses'),
        apiGet('/api/admin/mrr'),
      ])
      setBusinesses(bizData.businesses)
      setMrr(mrrData)
    } catch (err: any) {
      setError(err.message || 'Accès refusé ou erreur serveur')
    } finally {
      setLoading(false)
    }
  }

  const handlePlanChange = async (businessId: string, plan: string) => {
    setUpdatingId(businessId)
    try {
      await apiPatch(`/api/admin/businesses/${businessId}`, { plan })
      setBusinesses((prev) =>
        prev.map((b) => (b.id === businessId ? { ...b, plan } : b))
      )
      // Refresh MRR
      const mrrData = await apiGet('/api/admin/mrr')
      setMrr(mrrData)
    } catch {
      // silently fail; user can retry
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            <span className="text-lg font-bold text-emerald-800">OrderFlow</span>
            <Badge variant="outline" className="text-xs ml-1">Admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500 hover:text-gray-800">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* MRR Summary */}
        {mrr && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="col-span-2 lg:col-span-1">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">MRR Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {mrr.mrr.toLocaleString()} <span className="text-sm font-normal text-gray-500">DH</span>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Boutiques</p>
                  <p className="text-2xl font-bold text-gray-900">{businesses.length}</p>
                </div>
              </CardContent>
            </Card>
            {Object.entries(mrr.breakdown).map(([plan, count]) => (
              <Card key={plan}>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 capitalize">{plan}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{PLAN_PRICES[plan] ?? 0} DH/mois</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Businesses table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Boutiques ({businesses.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Chargement...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">{error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Boutique</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Plan</th>
                      <th className="px-4 py-3 text-right">Commandes</th>
                      <th className="px-4 py-3 text-left">Inscrit le</th>
                      <th className="px-4 py-3 text-left">Changer plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((b) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                        <td className="px-4 py-3 text-gray-500">{b.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[b.plan] ?? 'bg-gray-100 text-gray-700'}`}>
                            {b.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{b.orderCount}</td>
                        <td className="px-4 py-3 text-gray-400">{formatDate(b.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={b.plan}
                            onValueChange={(val) => handlePlanChange(b.id, val)}
                            disabled={updatingId === b.id}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="trial">Trial</SelectItem>
                              <SelectItem value="starter">Starter</SelectItem>
                              <SelectItem value="growth">Growth</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                    {businesses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          Aucune boutique
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
