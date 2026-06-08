import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function Signup() {
  const [boutiqueName, setBoutiqueName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signupFull } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    try {
      await signupFull({ boutiqueName, email, password, whatsappNumber })
      navigate('/onboarding')
    } catch (err: any) {
      setError(err.message || 'Échec de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-emerald-800">OrderFlow</h1>
          <p className="text-emerald-600 mt-1">Commencez gratuitement — 30 jours d'essai</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Créer votre compte</CardTitle>
            <CardDescription>Configurez votre boutique en 2 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="boutique-name">Nom de la boutique</Label>
                <Input
                  id="boutique-name"
                  type="text"
                  value={boutiqueName}
                  onChange={(e) => setBoutiqueName(e.target.value)}
                  placeholder="Ex: Zethnika Store"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Mot de passe</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  required
                />
              </div>
              <div>
                <Label htmlFor="whatsapp-number">
                  Numéro WhatsApp Business
                  <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
                </Label>
                <Input
                  id="whatsapp-number"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+212 6XX XX XX XX"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
              >
                {loading ? '...' : 'Créer mon compte'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-emerald-600 hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
