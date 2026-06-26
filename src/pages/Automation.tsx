import { useState, useEffect, useRef } from 'react'
import { Bot, Wifi, WifiOff, X, QrCode, Hash, Check, ImagePlus, Loader2, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowConfig {
  enabled: boolean
  imageUrls: string[]
  welcomeMessage: string
  question: string
  replyVous: string
  replyCadeau: string
}

const DEFAULT_FLOW: FlowConfig = {
  enabled: false,
  imageUrls: [],
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

// ─── Bouquet gallery ──────────────────────────────────────────────────────────

const MAX_IMAGES = 8

interface UploadSlot {
  id: string
  blobUrl: string
  error: string | null
}

async function uploadToServer(file: File): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const formData = new FormData()
  formData.append('image', file)
  const API_URL = import.meta.env.VITE_API_URL || ''
  const res = await fetch(`${API_URL}/api/whatsapp/upload-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erreur inconnue' })) as { error?: string }
    throw new Error(body.error ?? 'Erreur inconnue')
  }
  const { url } = await res.json() as { url: string }
  return url
}

function BouquetGallery({ values, onChange }: {
  values: string[]
  onChange: (urls: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [slot, setSlot] = useState<UploadSlot | null>(null)

  // One upload at a time: add button hidden while a slot is active
  const total = values.length + (slot ? 1 : 0)
  const canAdd = total < MAX_IMAGES && !slot

  function move(idx: number, dir: -1 | 1) {
    const next = [...values]
    const swap = idx + dir
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }

  async function handleFile(file: File) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const blobUrl = URL.createObjectURL(file)
    setSlot({ id, blobUrl, error: null })

    try {
      const url = await uploadToServer(file)
      URL.revokeObjectURL(blobUrl)
      setSlot(null)
      onChange([...values, url])
    } catch (err) {
      setSlot(s => s?.id === id
        ? { ...s, error: err instanceof Error ? err.message : 'Erreur' }
        : s
      )
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && canAdd) handleFile(file)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Photos du bouquet</label>
        <span className="text-xs text-gray-400">{total}/{MAX_IMAGES}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Committed images */}
        {values.map((url, idx) => (
          <div key={url + idx} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
            <img src={url} alt={`Bouquet ${idx + 1}`} className="w-full h-full object-cover" />

            {/* Delete */}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-red-500 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>

            {/* Reorder arrows */}
            <div className="absolute bottom-1.5 left-1.5 flex gap-1">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-gray-900/80 transition-colors"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              )}
              {idx < values.length - 1 && (
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-gray-900/80 transition-colors"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Uploading / error slot */}
        {slot && (
          <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
            <img src={slot.blobUrl} alt="En cours…" className="w-full h-full object-cover opacity-60" />
            {slot.error ? (
              <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center gap-1.5 px-2">
                <p className="text-xs text-red-500 text-center leading-tight">{slot.error}</p>
                <button
                  type="button"
                  onClick={() => { URL.revokeObjectURL(slot.blobUrl); setSlot(null) }}
                  className="text-xs text-red-600 font-medium underline"
                >
                  Retirer
                </button>
              </div>
            ) : (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Add button */}
        {canAdd && (
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-square cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
          >
            <ImagePlus className="h-6 w-6 text-gray-300" />
            <span className="text-xs text-gray-400 text-center leading-tight">
              Ajouter<br />une photo
            </span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {values.length === 0 && !slot && (
        <p className="text-xs text-gray-400 mt-1">JPEG · PNG · WebP — max 5 Mo par photo · max {MAX_IMAGES} photos</p>
      )}
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
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<number | null>(null)
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
      if (countdownRef.current !== null) clearInterval(countdownRef.current)
    }
  }, [onConnected])

  // Format phone on blur: strip spaces/dashes/parens, keep leading +
  function formatPhone(raw: string): string {
    const digits = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
    return digits
  }

  function startCountdown() {
    if (countdownRef.current !== null) clearInterval(countdownRef.current)
    setCountdown(60)
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function fetchPairingCode() {
    if (!phoneInput.trim()) return
    if (countdownRef.current !== null) clearInterval(countdownRef.current)
    setCountdown(null)
    setPairingLoading(true)
    setPairingCode(null)
    setCopied(false)
    setError(null)
    try {
      const { code } = await apiPost('/api/whatsapp/pairing-code', { phoneNumber: phoneInput.trim() })
      // Format as XXXX-XXXX if 8 chars without separator
      const raw = code as string
      const formatted = raw.includes('-') ? raw : raw.replace(/^(.{4})(.{4})$/, '$1-$2')
      setPairingCode(formatted)
      startCountdown()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? ''
      setError(msg || 'Impossible de récupérer le code de liaison.')
    } finally {
      setPairingLoading(false)
    }
  }

  async function copyCode() {
    if (!pairingCode) return
    await navigator.clipboard.writeText(pairingCode.replace('-', ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          <div className="flex items-center justify-between gap-2 bg-red-50 rounded-xl px-3 py-2">
            <p className="text-xs text-red-500 flex-1">{error}</p>
            {tab === 'code' && (
              <button
                onClick={fetchPairingCode}
                disabled={pairingLoading || !phoneInput.trim()}
                className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-50 shrink-0"
              >
                Réessayer
              </button>
            )}
          </div>
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
                  onBlur={e => setPhoneInput(formatPhone(e.target.value))}
                  placeholder="212612345678"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  onClick={fetchPairingCode}
                  disabled={pairingLoading || !phoneInput.trim() || (countdown !== null && countdown > 0)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {pairingLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : 'OK'}
                </button>
              </div>
            </div>

            {/* Code display */}
            <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-5 px-4">
              <span className={`text-2xl font-bold tracking-widest font-mono text-center break-all select-all leading-snug ${pairingCode ? 'text-gray-900' : 'text-gray-300'}`}>
                {pairingCode ?? '····-····'}
              </span>
              {pairingCode && (
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                  >
                    {copied
                      ? <><Check className="h-3.5 w-3.5" /> Copié !</>
                      : 'Copier'}
                  </button>
                  {countdown !== null && countdown > 0 && (
                    <span className="text-xs text-gray-400">expire dans {countdown}s</span>
                  )}
                </div>
              )}
            </div>

            {/* Expired state */}
            {countdown === 0 && (
              <button
                onClick={fetchPairingCode}
                disabled={pairingLoading}
                className="w-full py-2 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors"
              >
                Obtenir un nouveau code
              </button>
            )}

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
      .then(raw => {
        const c = raw as Record<string, unknown>
        // Backward compat: old format stored imageUrl (string), new format uses imageUrls (array)
        const imageUrls = Array.isArray(c.imageUrls) && (c.imageUrls as string[]).length > 0
          ? (c.imageUrls as string[])
          : typeof c.imageUrl === 'string' && c.imageUrl ? [c.imageUrl] : []
        setFlow({ ...DEFAULT_FLOW, ...(c as Partial<FlowConfig>), imageUrls })
      })
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

            {/* Bouquet gallery */}
            <BouquetGallery
              values={flow.imageUrls}
              onChange={urls => setFlow(f => ({ ...f, imageUrls: urls }))}
            />

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
