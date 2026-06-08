import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet, apiPost } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Volume2, VolumeX, RefreshCw, AlertTriangle,
  CheckCircle2, Info, AlertCircle, Send,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Alert {
  id: string
  type: 'urgent' | 'warning' | 'info' | 'success'
  message: string
  action?: string
  actionRoute?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  suggestedQuestions?: string[]
}

const DEFAULT_QUESTIONS = [
  "Combien j'ai gagné ce mois ?",
  'Quels sont mes meilleurs clients ?',
  'Quel produit se vend le mieux ?',
  'Combien de commandes en attente ?',
  'Comment étaient mes ventes cette semaine ?',
  'Donne-moi un conseil pour augmenter mes ventes',
]

// ── Alert banner ──────────────────────────────────────────────────────────────

function AlertBanner({ alert, onAction }: { alert: Alert; onAction: (route: string) => void }) {
  const styles: Record<Alert['type'], string> = {
    urgent: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-orange-50 border-orange-200 text-orange-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  const icons: Record<Alert['type'], React.ElementType> = {
    urgent: AlertCircle,
    warning: AlertTriangle,
    success: CheckCircle2,
    info: Info,
  }
  const Icon = icons[alert.type]

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${styles[alert.type]}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-sm flex-1">{alert.message}</span>
      {alert.action && alert.actionRoute && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs shrink-0 border-current hover:bg-white/50 bg-transparent"
          onClick={() => onAction(alert.actionRoute!)}
        >
          {alert.action}
        </Button>
      )}
    </div>
  )
}

// ── Loading dots ──────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex gap-1 items-center py-1 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-2 w-2 bg-gray-400 rounded-full inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{children}</h2>
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Agent() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [summary, setSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [_isDone, setIsDone] = useState(false)

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  const [advice, setAdvice] = useState<string | null>(null)
  const [loadingAdvice, setLoadingAdvice] = useState(true)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  if (!user) { navigate('/login'); return null }

  useEffect(() => {
    apiGet('/api/agent/alerts')
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoadingAlerts(false))
    apiGet('/api/agent/advice')
      .then((d: { advice: string }) => setAdvice(d.advice))
      .catch(() => setAdvice(null))
      .finally(() => setLoadingAdvice(false))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      window.speechSynthesis?.cancel()
    }
  }, [])

  function cleanSummaryText(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/`(.*?)`/g, '$1')
      .replace(/[📊🎙️💡✅⚠️👍🤝💪🔔📈📉]/g, '')
      .trim()
  }

  async function handleSummary() {
    if (loadingAudio) return
    if (speaking) {
      stopSpeaking()
      return
    }
    if (summary) {
      speak(summary)
      return
    }
    setLoadingSummary(true)
    try {
      const data = await apiGet('/api/agent/daily-summary')
      const cleaned = cleanSummaryText(data.summary)
      setSummary(cleaned)
      speak(cleaned)
    } catch {
      // silent fail
    } finally {
      setLoadingSummary(false)
    }
  }

  async function speak(text: string) {
    setLoadingAudio(true)
    setIsDone(false)

    try {
      const API_URL = import.meta.env.VITE_API_URL || ''
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      const response = await fetch(`${API_URL}/api/agent/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) throw new Error(`TTS request failed: ${response.status}`)

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setSpeaking(false); setIsDone(true); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false); setLoadingAudio(false); URL.revokeObjectURL(url) }

      setLoadingAudio(false)
      setSpeaking(true)
      audio.play()
    } catch (e) {
      console.error('[TTS] speak() failed:', e)
      setLoadingAudio(false)
      setSpeaking(false)
    }
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setSpeaking(false)
    setLoadingAudio(false)
  }

  function refreshAdvice() {
    setAdvice(null)
    setLoadingAdvice(true)
    apiGet('/api/agent/advice')
      .then((d: { advice: string }) => setAdvice(d.advice))
      .catch(() => setAdvice(null))
      .finally(() => setLoadingAdvice(false))
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || chatLoading) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setChatLoading(true)

    const conversationHistory = messages
      .slice(-10)
      .map(m => ({ role: m.role === 'agent' ? 'assistant' as const : 'user' as const, content: m.content }))

    try {
      const data = await apiPost('/api/agent/chat', {
        message: trimmed,
        conversationHistory,
      }) as { reply: string; suggestedQuestions: string[] }

      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'agent',
          content: data.reply,
          timestamp: new Date(),
          suggestedQuestions: data.suggestedQuestions ?? [],
        },
      ])
    } catch (err) {
      let errMsg = "Désolé, une erreur s'est produite. Réessayez dans quelques secondes."
      try {
        const parsed = JSON.parse((err as Error).message)
        if (parsed.error) errMsg = parsed.error
      } catch { /* ignore */ }
      setMessages(prev => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'agent', content: errMsg, timestamp: new Date() },
      ])
    } finally {
      setChatLoading(false)
    }
  }, [messages, chatLoading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
  }

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Votre Agent IA
            </h1>
            <p className="text-sm text-gray-500 mt-1">Posez n'importe quelle question sur votre boutique</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            En ligne
          </div>
        </div>

        {/* ── Section 1: Résumé du jour ── */}
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <SectionTitle>Résumé du jour</SectionTitle>
          <Button
            onClick={handleSummary}
            disabled={loadingSummary || loadingAudio}
            variant="outline"
            size="sm"
            className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {loadingSummary ? 'Génération...' : loadingAudio ? 'Chargement audio...' : speaking ? 'Arrêter' : '▶ Écouter le résumé du jour'}
          </Button>
          {summary && (
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border">
              {summary}
            </p>
          )}
        </section>

        {/* ── Section 2: Alertes intelligentes ── */}
        <section className="space-y-3">
          <SectionTitle>Alertes intelligentes</SectionTitle>
          {loadingAlerts ? (
            <div className="bg-white rounded-xl border p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Tout va bien aujourd'hui ✓
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => (
                <AlertBanner key={alert.id} alert={alert} onAction={navigate} />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 3: Conseil du jour ── */}
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Conseil du jour</SectionTitle>
            <button
              onClick={refreshAdvice}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Actualiser
            </button>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-2xl shrink-0">💡</span>
            {loadingAdvice ? (
              <div className="space-y-2 flex-1 pt-1">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
              </div>
            ) : advice ? (
              <p className="text-sm text-gray-700 leading-relaxed">{advice}</p>
            ) : (
              <p className="text-sm text-gray-400">Impossible de charger le conseil.</p>
            )}
          </div>
        </section>

        {/* ── Section 4: Chat avec l'agent ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Chat avec l'agent</SectionTitle>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setInput('') }}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Nouvelle conversation
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border overflow-hidden flex flex-col" style={{ height: '520px' }}>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-5 pt-2">
                  <p className="text-sm text-gray-500 text-center">
                    ✨ Bonjour ! Je connais toutes les données de votre boutique en temps réel.<br />
                    <span className="text-gray-400">Que voulez-vous savoir ?</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-gray-200 rounded-full px-3 py-1.5 transition-colors text-gray-600"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      style={{ animation: 'fadeInUp 0.2s ease-out' }}
                    >
                      {msg.role === 'agent' && (
                        <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs shrink-0 mt-1 font-bold">
                          ✨
                        </div>
                      )}
                      <div className={`max-w-[78%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#25D366] text-white rounded-tr-sm'
                              : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className={`text-xs text-gray-400 px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.role === 'agent' && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {msg.suggestedQuestions.map(q => (
                              <button
                                key={q}
                                onClick={() => sendMessage(q)}
                                className="text-xs bg-white border border-gray-200 hover:border-emerald-300 hover:text-emerald-700 rounded-full px-2.5 py-1 transition-colors text-gray-600"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs shrink-0 font-bold">
                        ✨
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                        <LoadingDots />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t p-3 flex gap-2 items-end bg-white">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                disabled={chatLoading}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 disabled:opacity-50 min-h-[40px]"
                style={{ lineHeight: '1.5', maxHeight: '128px' }}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={chatLoading || !input.trim()}
                className="bg-[#25D366] hover:bg-[#20c05c] text-white h-10 w-10 p-0 rounded-xl shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </section>

      </main>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
