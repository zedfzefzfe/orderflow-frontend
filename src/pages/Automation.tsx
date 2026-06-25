import { useState, useEffect, useRef } from 'react'
import { Bot, Wifi, WifiOff, X, QrCode, Hash, Check } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowConfig {
  enabled: boolean
  imageUrl: string
  welcomeMessage: string
  question: string
  replyVous: string
  replyCadeau: string
}

const DEFAULT_FLOW: FlowConfig = {
  enabled: false,
  imageUrl: '',
  welcomeMessage: '',
  question: "C'est pour vous ou un cadeau ? 🌸",
  replyVous: '',
  replyCadeau: '',
}

// ─── Card shell ───────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ─── Connection modal ─────────────────────────────────────────────────────────

function ConnectModal({ onClose, onConnected }: {
  onClose: () => void
  onConnected: () => void
}) {
  const [tab, setTab] = useState<'qr' | 'code'>('qr')
  const [qr, setQr] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [pairingLoading, setPairingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qrIntervalRef = useRef<number | null>(null)
  const statusIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    // POST /connect on modal open — creates Evolution instance and gets first QR
    async function connect() {
      setQrLoading(true)
      setError(null)
      try {
        const { qr: qrData } = await apiPost('/api/whatsapp/connect', {})
        if (!cancelled) setQr(qrData as string | null)
      } catch {
        if (!cancelled) setError("Impossible de créer l'instance WhatsApp. Réessayez.")
      } finally {
        if (!cancelled) setQrLoading(false)
      }
    }

    connect()

    // Refresh QR every 20 s (QR codes expire)
    qrIntervalRef.current = window.setInterval(async () => {
      if (cancelled) return
      try {
        const { qr: fresh } = await apiGet('/api/whatsapp/qr')
        if (!cancelled && fresh) setQr(fresh as string)
      } catch { /* silent — keep showing last QR */ }
    }, 20_000)

    // Poll connection status every 5 s
    statusIntervalRef.current = window.setInterval(async () => {
      if (cancelled) return
      try {
        const { connected } = await apiGet('/api/whatsapp/status')
        if (connected && !cancelled) onConnected()
      } catch { /* silent */ }
    }, 5_000)

    return () => {
      cancelled = true
      if (qrIntervalRef.current !== null) clearInterval(qrIntervalRef.current)
      if (statusIntervalRef.current !== null) clearInterval(statusIntervalRef.current)
    }
  }, [onConnected])

  async function fetchPairingCode() {
    if (!phoneInput.trim()) return
    setPairingLoading(true)
    setPairingCode(null)
    setError(null)
    try {
      const { code } = await apiPost('/api/whatsapp/pairing-code', { phoneNumber: phoneInput.trim() })
      setPairingCode(code as string)
    } catch {
      setError('Impossible de récupérer le code de liaison.')
    } finally {
      setPairingLoading(false)
    }
  }

  // Normalize base64: Evolution may return a full data URL or a raw base64 string
  function toImgSrc(raw: string): string {
    return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Connecter WhatsApp</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-gray-200 p-1 gap-1">
          <button
            onClick={() => setTab('qr')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'qr' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <QrCode className="h-3.5 w-3.5" />
            Scanner le QR code
          </button>
          <button
            onClick={() => setTab('code')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'code' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Hash className="h-3.5 w-3.5" />
            Lier avec un code
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        {/* Tab content */}
        {tab === 'qr' ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-48 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <QrCode className="h-10 w-10 animate-pulse" />
                  <span className="text-xs">Génération en cours…</span>
                </div>
              ) : qr ? (
                <img
                  src={toImgSrc(qr)}
                  alt="QR WhatsApp"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <QrCode className="h-10 w-10" />
                  <span className="text-xs text-center px-4">QR indisponible</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center">
              Ouvrez WhatsApp → <strong>Appareils connectés</strong> → <strong>Lier un appareil</strong> → scannez ce code
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de téléphone
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  placeholder="212612345678"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  onClick={fetchPairingCode}
                  disabled={pairingLoading || !phoneInput.trim()}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {pairingLoading ? '…' : 'OK'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-5">
              <span className={`text-3xl font-bold tracking-[0.35em] select-all ${pairingCode ? 'text-gray-900' : 'text-gray-300'}`}>
                {pairingCode ?? '········'}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Ouvrez WhatsApp → <strong>Appareils connectés</strong> → <strong>Lier avec le numéro de téléphone</strong> → saisissez ce code.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Automation() {
  // Card 1 — connection state
  const [connected, setConnected] = useState(false)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Card 2 — welcome flow form
  const [flow, setFlow] = useState<FlowConfig>(DEFAULT_FLOW)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // On mount: load connection status + saved flow config
  useEffect(() => {
    apiGet('/api/whatsapp/status')
      .then(({ connected: c }) => { setConnected(Boolean(c)); setStatusLoaded(true) })
      .catch(() => setStatusLoaded(true))

    apiGet('/api/whatsapp/flow')
      .then(config => setFlow({ ...DEFAULT_FLOW, ...(config as Partial<FlowConfig>) }))
      .catch(() => { /* keep defaults */ })
  }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPut('/api/whatsapp/flow', flow)
      showToast('Paramètres enregistrés', true)
    } catch {
      showToast('Erreur lors de la sauvegarde', false)
    } finally {
      setSaving(false)
    }
  }

  function handleConnected() {
    setConnected(true)
    setShowModal(false)
    showToast('WhatsApp connecté avec succès !', true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automatisation WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connectez votre numéro et configurez vos réponses automatiques</p>
        </div>

        {/* ── Card 1: WhatsApp connection ── */}
        <SectionCard icon={Bot} title="Connexion WhatsApp">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" />
              )}
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {!statusLoaded ? '…' : connected ? 'Connecté ✅' : 'Non connecté'}
              </span>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              {connected ? 'Reconnecter' : 'Connecter WhatsApp'}
            </button>
          </div>
        </SectionCard>

        {/* ── Card 2: Welcome message flow ── */}
        <SectionCard icon={Bot} title="Message de bienvenue automatique">
          <div className="space-y-4">

            {/* Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700">Activer la réponse automatique</p>
                <p className="text-xs text-gray-400">Envoyé au premier message de chaque nouveau client</p>
              </div>
              <button
                type="button"
                onClick={() => setFlow(f => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${flow.enabled ? 'bg-emerald-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${flow.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Image URL — accepts a public URL for now */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL de la photo du bouquet</label>
              <input
                type="url"
                value={flow.imageUrl}
                onChange={e => setFlow(f => ({ ...f, imageUrl: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="https://exemple.com/bouquet.jpg"
              />
              {/* TODO: replace with file upload to Supabase Storage (or similar CDN) once image hosting is set up */}
              <p className="text-xs text-gray-400 mt-1">Collez l'URL publique de votre image.</p>
            </div>

            {/* Welcome message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message de bienvenue</label>
              <textarea
                value={flow.welcomeMessage}
                onChange={e => setFlow(f => ({ ...f, welcomeMessage: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                placeholder="Bonjour 👋 Bienvenue sur notre boutique…"
              />
            </div>

            {/* Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
              <input
                type="text"
                value={flow.question}
                onChange={e => setFlow(f => ({ ...f, question: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Reply: pour vous */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Réponse si « pour vous »</label>
              <textarea
                value={flow.replyVous}
                onChange={e => setFlow(f => ({ ...f, replyVous: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                placeholder="Super ! Voici nos créations du moment…"
              />
            </div>

            {/* Reply: cadeau */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Réponse si « cadeau »</label>
              <textarea
                value={flow.replyCadeau}
                onChange={e => setFlow(f => ({ ...f, replyCadeau: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                placeholder="Quelle belle attention ! Pour qui est ce cadeau ?…"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </SectionCard>

      </main>

      {showModal && (
        <ConnectModal
          onClose={() => setShowModal(false)}
          onConnected={handleConnected}
        />
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <Check className="h-4 w-4 shrink-0" />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
