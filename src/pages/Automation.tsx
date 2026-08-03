import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, Wifi, WifiOff, X, QrCode, Check, Loader2, Plus, Smartphone } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import AutomationCard, { AutomationsEmptyState, type Automation as AutomationItem } from '@/components/AutomationCard'

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

  // Automations list
  const [automations, setAutomations] = useState<AutomationItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Only one uncreated card at a time, so its React key stays unambiguous
  const hasDraft = automations.some(a => !a.id)

  // On mount: load connection status + automations
  useEffect(() => {
    apiGet('/api/whatsapp/status')
      .then(({ connected: c }) => { setConnected(Boolean(c)); setStatusLoaded(true) })
      .catch(() => setStatusLoaded(true))

    loadAutomations()
  }, [])

  async function loadAutomations() {
    setListLoading(true)
    setListError(null)
    try {
      const raw = await apiGet('/api/automations')
      // Accept both a bare array and a { automations: [...] } envelope
      const list = (Array.isArray(raw) ? raw : raw?.automations ?? []) as AutomationItem[]
      setAutomations([...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)))
    } catch {
      setListError('Impossible de charger vos automatisations.')
    } finally {
      setListLoading(false)
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  // The server requires a triggerMessage, so a new automation starts as a local
  // card (id: '') and is POSTed by the card itself on « Créer ». Photos come
  // after, since the upload route is scoped to an existing :id.
  function handleCreate() {
    if (hasDraft) return
    setListError(null)
    setAutomations(list => [...list, {
      id: '',
      name: '',
      triggerMessage: '',
      welcomeMessage: '',
      photoUrls: [],
      videoUrl: null,
      documentUrls: [],
      isActive: true,
      priority: list.length,
    }])
  }

  function handleSaved(updated: AutomationItem, previousId: string) {
    setAutomations(list => list.map(a => (a.id === previousId ? { ...a, ...updated } : a)))
  }

  function handleDeleted(id: string) {
    setAutomations(list => list.filter(a => a.id !== id))
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

        {/* ── Automations ── */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Vos automatisations</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Une automatisation par pub Meta, déclenchée par son message pré-rempli
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={hasDraft}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nouvelle automatisation
          </button>
        </div>

        {listError && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{listError}</p>
            <button
              onClick={loadAutomations}
              className="text-sm font-medium text-red-700 underline shrink-0"
            >
              Réessayer
            </button>
          </div>
        )}

        {listLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
          </div>
        ) : automations.length === 0 && !listError ? (
          <AutomationsEmptyState onCreate={handleCreate} />
        ) : (
          automations.map(a => (
            <AutomationCard
              key={a.id || 'new'}
              automation={a}
              autoFocus={!a.id}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onToast={showToast}
            />
          ))
        )}

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
