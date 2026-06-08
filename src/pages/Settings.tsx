import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, MessageSquare, AlertTriangle, Check, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet, apiPatch } from '@/lib/api'

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

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
    >
      {loading ? 'Sauvegarde...' : 'Sauvegarder'}
    </button>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) { navigate('/'); return null }

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Section 1 — Profil
  const [boutiqueName, setBoutiqueName] = useState('')
  const [savingProfil, setSavingProfil] = useState(false)

  // Section 2 — WhatsApp
  const [notifyPhone, setNotifyPhone] = useState('')
  const [wabaPhone, setWabaPhone] = useState('')
  const [savingWA, setSavingWA] = useState(false)

  useEffect(() => {
    apiGet('/api/business/me').then((d) => {
      if (d?.name) setBoutiqueName(d.name)
      if (d?.ownerNotifyPhone) setNotifyPhone(d.ownerNotifyPhone)
      if (d?.whatsappPhoneNumberId) setWabaPhone(d.whatsappPhoneNumberId)
    }).catch(() => {})
  }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  async function save(payload: Record<string, unknown>, setSaving: (v: boolean) => void) {
    setSaving(true)
    try {
      await apiPatch('/api/business/me', payload)
      showToast('✅ Paramètres sauvegardés', true)
    } catch {
      showToast('❌ Erreur lors de la sauvegarde', false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configurez votre boutique et vos notifications</p>
        </div>

        {/* ── Section 1: Profil boutique ── */}
        <SectionCard icon={Store} title="Profil boutique">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
              <input
                type="text"
                value={boutiqueName}
                onChange={e => setBoutiqueName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Ma Boutique"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                  Photo
                </div>
                <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50" disabled>
                  Changer (bientôt)
                </button>
              </div>
            </div>
          </div>
          <SaveButton loading={savingProfil} onClick={() => save({ name: boutiqueName }, setSavingProfil)} />
        </SectionCard>

        {/* ── Section 2: WhatsApp ── */}
        <SectionCard icon={MessageSquare} title="Configuration WhatsApp">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp boutique</label>
              <input
                type="text"
                value={wabaPhone}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed"
                placeholder="Configuré via yCloud"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de notification marchand</label>
              <input
                type="text"
                value={notifyPhone}
                onChange={e => setNotifyPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="0625869380"
              />
              <p className="text-xs text-gray-400 mt-1">Votre numéro personnel — vous recevrez les notifications ici</p>
            </div>
          </div>
          <SaveButton loading={savingWA} onClick={() => save({ ownerNotifyPhone: notifyPhone }, setSavingWA)} />
        </SectionCard>

        {/* ── Section 3: Danger zone ── */}
        <SectionCard icon={AlertTriangle} title="Zone de danger">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-700">Déconnexion</p>
                <p className="text-xs text-gray-400">Se déconnecter de votre compte</p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Se déconnecter
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
              <div>
                <p className="text-sm font-medium text-red-700">Supprimer mon compte</p>
                <p className="text-xs text-red-400">Action irréversible — toutes vos données seront supprimées</p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </SectionCard>

      </main>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900">Supprimer le compte ?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Toutes vos commandes, paramètres et données seront définitivement supprimés. Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); showToast('Contactez le support pour supprimer votre compte', false) }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-in fade-in slide-in-from-bottom-2 ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.ok ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
