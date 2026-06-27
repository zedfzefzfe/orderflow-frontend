import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, Wifi, WifiOff, X, QrCode, Check, ImagePlus, Loader2, Trash2, ChevronUp, ChevronDown, Smartphone } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
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
  const [qr, setQr] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState('Initialisation en cours...')
  const [error, setError] = useState<string | null>(null)

  const [showSendQr, setShowSendQr] = useState(false)
  const [sendQrPhone, setSendQrPhone] = useState('')
  const [sendQrLoading, setSendQrLoading] = useState(false)
  const [sendQrResult, setSendQrResult] = useState<'success' | 'error' | null>(null)

  const connectCalledRef = useRef(false)
  const qrReceivedRef = useRef(false)
  const qrIntervalRef = useRef<number | null>(null)
  const statusIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    // Loading message progression
    const t1 = window.setTimeout(() => {
      if (!cancelled) setLoadingMsg('Connexion à WhatsApp...')
    }, 5_000)
    const t2 = window.setTimeout(() => {
      if (!cancelled) setLoadingMsg('Presque prêt, encore quelques secondes...')
    }, 12_000)

    // Called whenever a valid QR string arrives — handles fast→slow poll switch
    function handleQr(raw: string) {
      setQr(raw)
      setQrLoading(false)
      if (!qrReceivedRef.current) {
        qrReceivedRef.current = true
        // Cancel the 3s fast poll and start the 20s slow refresh
        if (qrIntervalRef.current !== null) {
          clearInterval(qrIntervalRef.current)
          qrIntervalRef.current = null
        }
        qrIntervalRef.current = window.setInterval(async () => {
          if (cancelled) return
          try {
            const { qr: fresh } = await apiGet('/api/whatsapp/qr')
            if (!cancelled && fresh) setQr(fresh as string)
          } catch { /* silent — keep showing last QR */ }
        }, 20_000)
      }
    }

    // POST /connect exactly once — connectCalledRef guards against StrictMode
    // double-invoke and any parent re-renders that might remount this effect
    if (!connectCalledRef.current) {
      connectCalledRef.current = true
      setQrLoading(true)
      setError(null)
      apiPost('/api/whatsapp/connect', {})
        .then(({ qr: qrData }) => {
          if (!cancelled && qrData) handleQr(qrData as string)
          // If connect() returned no QR yet, the 3s fast poll below will pick it up
        })
        .catch(() => {
          if (!cancelled) {
            setError("Impossible de créer l'instance WhatsApp. Réessayez.")
            setQrLoading(false)
          }
        })
    }

    // Fast QR poll every 3s — fires immediately and keeps going until QR is received,
    // at which point handleQr() clears this interval and starts the 20s slow refresh
    qrIntervalRef.current = window.setInterval(async () => {
      if (cancelled || qrReceivedRef.current) return
      try {
        const { qr: fresh } = await apiGet('/api/whatsapp/qr')
        if (!cancelled && fresh) handleQr(fresh as string)
      } catch { /* silent */ }
    }, 3_000)

    // Status poll every 5s
    statusIntervalRef.current = window.setInterval(async () => {
      if (cancelled) return
      try {
        const { connected } = await apiGet('/api/whatsapp/status')
        if (connected && !cancelled) onConnected()
      } catch { /* silent */ }
    }, 5_000)

    return () => {
      cancelled = true
      clearTimeout(t1)
      clearTimeout(t2)
      if (qrIntervalRef.current !== null) clearInterval(qrIntervalRef.current)
      if (statusIntervalRef.current !== null) clearInterval(statusIntervalRef.current)
    }
  }, [onConnected])

  function toImgSrc(raw: string): string {
    return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
  }

  async function handleSendQr() {
    if (!sendQrPhone.trim() || !qr) return
    setSendQrLoading(true)
    setSendQrResult(null)
    try {
      await apiPost('/api/whatsapp/send-qr', { recipientNumber: sendQrPhone.trim(), qrBase64: qr })
      setSendQrResult('success')
      setSendQrPhone('')
    } catch {
      setSendQrResult('error')
    } finally {
      setSendQrLoading(false)
    }
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

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-48 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            {qrLoading ? (
              <div className="flex flex-col items-center gap-2 text-gray-400 px-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs">{loadingMsg}</span>
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

          {/* Send QR to another phone — only shown once QR is available */}
          {!qrLoading && qr && (
            <div className="w-full">
              {!showSendQr ? (
                <button
                  onClick={() => { setSendQrResult(null); setSendQrPhone(''); setShowSendQr(true) }}
                  className="w-full text-xs text-indigo-500 flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Sur mobile ? Envoyez le QR par WhatsApp
                </button>
              ) : (
                <div className="bg-indigo-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-indigo-700">Recevoir le QR sur un autre téléphone</p>
                  {sendQrResult === 'success' ? (
                    <p className="text-xs text-green-600 text-center py-1">✅ QR envoyé avec succès !</p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          placeholder="06 00 00 00 00"
                          value={sendQrPhone}
                          onChange={e => setSendQrPhone(e.target.value)}
                          disabled={sendQrLoading}
                          className="flex-1 text-xs rounded-lg border border-indigo-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button
                          onClick={handleSendQr}
                          disabled={sendQrLoading || !sendQrPhone.trim()}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors flex items-center"
                        >
                          {sendQrLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Envoyer'}
                        </button>
                      </div>
                      {sendQrResult === 'error' && (
                        <p className="text-xs text-red-500">Impossible d'envoyer. Vérifiez le numéro.</p>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => setShowSendQr(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Ouvrez WhatsApp → <strong>Appareils connectés</strong> → <strong>Lier un appareil</strong> → scannez ce code
          </p>
          <p className="text-xs text-gray-400 text-center italic">
            💻 Pour connecter depuis votre téléphone, ouvrez cette page sur un ordinateur ou demandez à un proche de scanner le QR.
          </p>
        </div>

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
  const [connectPending, setConnectPending] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

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

  const handleConnected = useCallback(() => {
    setConnected(true)
    setShowModal(false)
    setConnectPending(false)
    showToast('WhatsApp connecté avec succès !', true)
  // showToast is stable (defined in same component scope, only calls setToast)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await apiDelete('/api/whatsapp/disconnect')
      setConnected(false)
      setShowDisconnectConfirm(false)
      showToast('WhatsApp déconnecté', true)
    } catch {
      showToast('Erreur lors de la déconnexion', false)
    } finally {
      setDisconnecting(false)
    }
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
            <div className="flex items-center gap-2">
              {connected && (
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                >
                  Déconnecter
                </button>
              )}
              <button
                onClick={() => { setConnectPending(true); setShowModal(true) }}
                disabled={connectPending || showModal}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {connectPending && !showModal && <Loader2 className="h-4 w-4 animate-spin" />}
                {connected ? 'Reconnecter' : 'Connecter WhatsApp'}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ── Disconnect confirmation dialog ── */}
        {showDisconnectConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Déconnecter WhatsApp</h3>
              <p className="text-sm text-gray-500">
                Êtes-vous sûr de vouloir déconnecter ce numéro WhatsApp ?
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  disabled={disconnecting}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Déconnecter'}
                </button>
              </div>
            </div>
          </div>
        )}

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
          onClose={() => { setShowModal(false); setConnectPending(false) }}
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
