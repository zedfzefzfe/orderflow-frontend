import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X, Zap } from 'lucide-react'

interface BusinessPlan {
  plan: string
  orderCount: number
  orderLimit: number
  usagePercent: number
  isUnlimited: boolean
  limitReached: boolean
  nearLimit: boolean
  trialEndsAt: string | null
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Essai',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
}

const PRICING = [
  { plan: 'starter', label: 'Starter', price: 299, orders: '200 commandes/mois', color: 'border-blue-400' },
  { plan: 'growth', label: 'Growth', price: 599, orders: 'Illimité', color: 'border-emerald-400', popular: true },
  { plan: 'pro', label: 'Pro', price: 999, orders: 'Illimité + API', color: 'border-purple-400' },
]

export default function PlanBanner() {
  const [planInfo, setPlanInfo] = useState<BusinessPlan | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    apiGet('/api/business/me')
      .then((data) => setPlanInfo(data))
      .catch(() => {/* non-critical */})
  }, [])

  if (!planInfo || planInfo.isUnlimited) return null
  if (!planInfo.nearLimit && !planInfo.limitReached) return null
  if (dismissed && planInfo.nearLimit && !planInfo.limitReached) return null

  return (
    <>
      {/* Banner */}
      <div
        className={`relative flex items-center gap-3 px-4 py-3 text-sm font-medium ${
          planInfo.limitReached
            ? 'bg-red-50 border-b border-red-200 text-red-800'
            : 'bg-amber-50 border-b border-amber-200 text-amber-800'
        }`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div className="flex-1">
          {planInfo.limitReached ? (
            <>
              Limite atteinte — {planInfo.orderCount}/{planInfo.orderLimit} commandes utilisées
              sur le plan <strong>{PLAN_LABELS[planInfo.plan]}</strong>. Les nouvelles commandes
              WhatsApp sont bloquées.
            </>
          ) : (
            <>
              Vous avez utilisé <strong>{planInfo.usagePercent}%</strong> de votre quota (
              {planInfo.orderCount}/{planInfo.orderLimit} commandes) — Plan{' '}
              <strong>{PLAN_LABELS[planInfo.plan]}</strong>.
            </>
          )}
        </div>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-7 text-xs gap-1"
          onClick={() => setShowModal(true)}
        >
          <Zap className="h-3 w-3" />
          Mettre à niveau
        </Button>
        {!planInfo.limitReached && (
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-600 hover:text-amber-900 ml-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Pricing modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Choisissez votre plan</h2>
                <p className="text-sm text-gray-500 mt-0.5">Paiement manuel — contactez-nous sur WhatsApp</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-3">
              {PRICING.map((p) => (
                <div
                  key={p.plan}
                  className={`relative rounded-xl border-2 p-5 flex flex-col gap-3 ${p.color} ${
                    p.popular ? 'shadow-md' : ''
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs px-3 py-0.5 rounded-full font-medium">
                      Populaire
                    </span>
                  )}
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{p.label}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">
                      {p.price} <span className="text-sm font-normal text-gray-500">DH/mois</span>
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">{p.orders}</p>
                  <a
                    href={`https://wa.me/212600000000?text=Je veux passer au plan ${p.label} pour OrderFlow`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                  >
                    Choisir {p.label}
                  </a>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 pb-4">
              Paiement par virement ou CIH — activation dans les 24h
            </p>
          </div>
        </div>
      )}
    </>
  )
}
