import { useState } from 'react'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MessageSquarePlus, X, Zap, CheckCircle, AlertCircle } from 'lucide-react'

const EXAMPLES = [
  {
    label: 'Darija',
    fromPhone: '212661234567',
    body: 'salam bghit 2 bougies vanille livraison Rabat nhar lkhmis',
  },
  {
    label: 'Français',
    fromPhone: '212622334455',
    body: 'Bonjour je voudrais 1 bouquet roses éternelles, adresse Casa Maarif, livraison demain',
  },
  {
    label: 'Question',
    fromPhone: '212633445566',
    body: 'chhal taman dyal bougie lavande?',
  },
]

interface SimulatorModalProps {
  onOrderCreated: () => void
}

interface SimResult {
  isOrder: boolean
  message?: string
  order?: { id: string; customerName: string; product: string }
}

export default function SimulatorModal({ onOrderCreated }: SimulatorModalProps) {
  const [open, setOpen] = useState(false)
  const [fromPhone, setFromPhone] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)
  const [error, setError] = useState('')

  const fillExample = (ex: typeof EXAMPLES[0]) => {
    setFromPhone(ex.fromPhone)
    setBody(ex.body)
    setResult(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await apiPost('/api/simulate/message', { fromPhone, body })
      setResult(res)
      if (res.isOrder) onOrderCreated()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la simulation')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setResult(null)
    setError('')
    setFromPhone('')
    setBody('')
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">Simuler</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Simuler une commande</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Teste le parsing IA sans WhatsApp
                </p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick-fill examples */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Exemples rapides</p>
              <div className="flex gap-2 flex-wrap">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => fillExample(ex)}
                    className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Zap className="inline h-3 w-3 mr-1" />
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="sim-phone">Numéro WhatsApp</Label>
                <Input
                  id="sim-phone"
                  value={fromPhone}
                  onChange={(e) => setFromPhone(e.target.value)}
                  placeholder="212612345678"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sim-body">Message client</Label>
                <textarea
                  id="sim-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="salam bghit 2 bougies vanille..."
                  rows={3}
                  required
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              {/* Result */}
              {result && (
                <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${result.isOrder ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {result.isOrder
                    ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  }
                  <div>
                    {result.isOrder
                      ? <>Commande créée pour <strong>{result.order?.customerName}</strong> — {result.order?.product}</>
                      : 'Message analysé : pas une commande (question ou salutation)'
                    }
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                  Fermer
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !body.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? 'Analyse en cours...' : 'Envoyer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
