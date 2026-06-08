import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type Step = 1 | 2 | 3

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [businessAccountId, setBusinessAccountId] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState('')

  const handleSaveCredentials = async () => {
    if (!phoneNumberId.trim() || !businessAccountId.trim()) {
      setError('Les deux champs sont requis')
      return
    }
    setError('')
    setSaving(true)
    try {
      await apiPost('/api/onboarding', {
        phoneNumberId: phoneNumberId.trim(),
        businessAccountId: businessAccountId.trim(),
      })
      setStep(3)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const data = await apiPost('/api/onboarding/test-connection', {})
      setTestResult({ success: true, message: `Connecté : ${data.phoneNumberName || 'OK'}` })
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connexion échouée' })
    } finally {
      setTesting(false)
    }
  }

  const stepLabels = ['Numéro ID', 'Compte Business', 'Test connexion']

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-emerald-800">OrderFlow</h1>
          <p className="text-emerald-600 mt-1">Configuration WhatsApp</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              <span className={`text-xs hidden sm:block ${step >= s ? 'text-emerald-700' : 'text-gray-400'}`}>
                {stepLabels[s - 1]}
              </span>
              {s < 3 && <div className={`h-px w-8 ${step > s ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <Card>
          {/* Step 1: Phone Number ID */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Étape 1 — Phone Number ID</CardTitle>
                <CardDescription>
                  Trouvez ce code dans{' '}
                  <strong>Meta Developer Console → WhatsApp → API Setup</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="phone-number-id">WhatsApp Phone Number ID</Label>
                  <Input
                    id="phone-number-id"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="Ex: 123456789012345"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    if (!phoneNumberId.trim()) { setError('Champ requis'); return }
                    setError('')
                    setStep(2)
                  }}
                >
                  Suivant
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 2: Business Account ID */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Étape 2 — Business Account ID</CardTitle>
                <CardDescription>
                  Trouvez cet ID dans{' '}
                  <strong>Meta Business Suite → Paramètres → Informations Business</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="business-account-id">WhatsApp Business Account ID</Label>
                  <Input
                    id="business-account-id"
                    value={businessAccountId}
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                    placeholder="Ex: 987654321098765"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Retour
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleSaveCredentials}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Test connection */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Étape 3 — Tester la connexion</CardTitle>
                <CardDescription>
                  Vérifiez que vos identifiants WhatsApp sont corrects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResult && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    {testResult.message}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Test en cours...</>
                  ) : (
                    'Tester la connexion WhatsApp'
                  )}
                </Button>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => navigate('/dashboard')}
                >
                  Aller au tableau de bord →
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  Vous pouvez configurer ça plus tard depuis les paramètres
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
