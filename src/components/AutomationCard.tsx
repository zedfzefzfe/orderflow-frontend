import { useRef, useState } from 'react'
import { FilePlus, FileText, Film, ImagePlus, Loader2, Trash2, Zap } from 'lucide-react'
import { apiDelete, apiErrorMessage, apiPost, apiPut, apiUpload } from '@/lib/api'

export interface Automation {
  id: string
  name: string
  triggerMessage: string
  welcomeMessage: string
  message2: string
  message3: string
  photoUrls: string[]
  videoUrls: string[]
  /** Legacy single-video field, still present on automations saved before multi-video. */
  videoUrl?: string | null
  documentUrls: string[]
  isActive: boolean
  priority: number
}

export const MAX_PHOTOS = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'

export const MAX_DOCS = 2
const MAX_DOC_SIZE = 16 * 1024 * 1024
const DOC_ACCEPTED = 'application/pdf'

export const MAX_VIDEOS = 3
// WhatsApp refuses to play inline video past ~16 Mo
const MAX_VIDEO_SIZE = 16 * 1024 * 1024
const VIDEO_ACCEPTED = 'video/mp4'

/** Storage paths are "<timestamp>-<original name>" — recover the readable part. */
function fileNameFromUrl(url: string): string {
  const last = url.split('?')[0].split('/').pop() ?? ''
  return decodeURIComponent(last).replace(/^\d+-/, '') || 'fichier'
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

/** POST/PUT may answer with the bare object or an { automation } envelope. */
export function unwrapAutomation(raw: unknown): Automation {
  const obj = raw as { automation?: Automation } | Automation
  return ((obj as { automation?: Automation })?.automation ?? obj) as Automation
}

/** Fields the user can edit — everything except id and priority. */
type Draft = Omit<Automation, 'id' | 'priority'>

function toDraft(a: Automation): Draft {
  return {
    name: a.name ?? '',
    triggerMessage: a.triggerMessage ?? '',
    welcomeMessage: a.welcomeMessage ?? '',
    // Optional follow-ups — absent on automations created before these fields existed
    message2: a.message2 ?? '',
    message3: a.message3 ?? '',
    photoUrls: a.photoUrls ?? [],
    // A pre-multi-video automation only has the single videoUrl — lift it into the array
    videoUrls: a.videoUrls ?? (a.videoUrl ? [a.videoUrl] : []),
    documentUrls: a.documentUrls ?? [],
    isActive: Boolean(a.isActive),
  }
}

export default function AutomationCard({ automation, autoFocus, onSaved, onDeleted, onToast }: {
  automation: Automation
  autoFocus?: boolean
  onSaved: (a: Automation, previousId: string) => void
  onDeleted: (id: string) => void
  onToast: (msg: string, ok: boolean) => void
}) {
  // The card owns its draft — the parent list is only updated on a successful save
  const [draft, setDraft] = useState<Draft>(() => toDraft(automation))
  const [saved, setSaved] = useState<Draft>(() => toDraft(automation))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Byte sizes are only known for files uploaded in this session — a reloaded
  // page has nothing but URLs, so the size is simply omitted then
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  // An empty id means this card only exists locally: the server rejects an
  // automation without a triggerMessage, so it is POSTed on first save
  const isNew = !automation.id
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const remainingSlots = MAX_PHOTOS - draft.photoUrls.length
  const remainingDocs = MAX_DOCS - draft.documentUrls.length
  const remainingVideos = MAX_VIDEOS - draft.videoUrls.length
  const busy = uploading || uploadingDocs || uploadingVideo

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(d => ({ ...d, [key]: value }))
    setError(null)
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setError("Donnez un nom à l'automatisation avant d'enregistrer.")
      return
    }
    if (!draft.triggerMessage.trim()) {
      setError('Le message pré-rempli déclencheur est obligatoire.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = isNew
        ? unwrapAutomation(await apiPost('/api/automations', { ...draft, priority: automation.priority }))
        : unwrapAutomation(await apiPut(`/api/automations/${automation.id}`, draft))
      const merged = { ...automation, ...result }
      const next = toDraft(merged)
      setDraft(next)
      setSaved(next)
      onSaved(merged, automation.id)
      onToast(isNew ? 'Automatisation créée' : 'Automatisation enregistrée', true)
    } catch (err) {
      const fallback = isNew ? 'Impossible de créer. Réessayez.' : "Impossible d'enregistrer. Réessayez."
      setError(apiErrorMessage(err, fallback))
      onToast(isNew ? 'Erreur lors de la création' : "Erreur lors de l'enregistrement", false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    // Nothing to delete server-side for a card that was never created
    if (isNew) {
      onDeleted(automation.id)
      return
    }
    setDeleting(true)
    try {
      await apiDelete(`/api/automations/${automation.id}`)
      onDeleted(automation.id)
      onToast('Automatisation supprimée', true)
    } catch (err) {
      setDeleting(false)
      setConfirmDelete(false)
      setError(apiErrorMessage(err, 'Impossible de supprimer. Réessayez.'))
      onToast('Erreur lors de la suppression', false)
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    if (files.length > remainingSlots) {
      setError(`${MAX_PHOTOS} photos maximum — il reste ${remainingSlots} emplacement${remainingSlots > 1 ? 's' : ''}.`)
      return
    }
    const tooBig = files.find(f => f.size > MAX_FILE_SIZE)
    if (tooBig) {
      setError(`« ${tooBig.name} » dépasse 5 Mo.`)
      return
    }

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('photos', f))
      const res = await apiUpload(`/api/automations/${automation.id}/photos`, formData) as {
        urls: string[]
        automation: Automation
      }
      // The upload persists photoUrls server-side straight away, so mirror it into
      // both draft and saved — any other pending edit in the draft stays untouched
      const photoUrls = res.automation?.photoUrls ?? [...draft.photoUrls, ...(res.urls ?? [])]
      setDraft(d => ({ ...d, photoUrls }))
      setSaved(s => ({ ...s, photoUrls }))
      onSaved({ ...automation, photoUrls }, automation.id)
      onToast(files.length > 1 ? 'Photos ajoutées' : 'Photo ajoutée', true)
    } catch (err) {
      setError(apiErrorMessage(err, "L'envoi des photos a échoué. Réessayez."))
      onToast("Erreur lors de l'envoi des photos", false)
    } finally {
      setUploading(false)
    }
  }

  /** Removal is local — persisted with the next « Enregistrer » (PUT photoUrls). */
  function removePhoto(idx: number) {
    set('photoUrls', draft.photoUrls.filter((_, i) => i !== idx))
  }

  async function handleDocs(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    if (files.length > remainingDocs) {
      setError(`${MAX_DOCS} fichiers maximum — il reste ${remainingDocs} emplacement${remainingDocs > 1 ? 's' : ''}.`)
      return
    }
    const wrongType = files.find(f => f.type !== DOC_ACCEPTED)
    if (wrongType) {
      setError(`« ${wrongType.name} » n'est pas un PDF.`)
      return
    }
    const tooBig = files.find(f => f.size > MAX_DOC_SIZE)
    if (tooBig) {
      setError(`« ${tooBig.name} » dépasse 16 Mo.`)
      return
    }

    setUploadingDocs(true)
    setError(null)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('documents', f))
      const res = await apiUpload(`/api/automations/${automation.id}/documents`, formData) as {
        urls: string[]
        automation: Automation
      }
      const documentUrls = res.automation?.documentUrls ?? [...draft.documentUrls, ...(res.urls ?? [])]
      // Map each returned URL back to the file it came from, in upload order
      const added = documentUrls.slice(draft.documentUrls.length)
      setSizes(s => ({ ...s, ...Object.fromEntries(added.map((u, i) => [u, files[i]?.size ?? 0])) }))
      setDraft(d => ({ ...d, documentUrls }))
      setSaved(s => ({ ...s, documentUrls }))
      onSaved({ ...automation, documentUrls }, automation.id)
      onToast(files.length > 1 ? 'PDF ajoutés' : 'PDF ajouté', true)
    } catch (err) {
      setError(apiErrorMessage(err, "L'envoi du PDF a échoué. Réessayez."))
      onToast("Erreur lors de l'envoi du PDF", false)
    } finally {
      setUploadingDocs(false)
    }
  }

  function removeDoc(idx: number) {
    set('documentUrls', draft.documentUrls.filter((_, i) => i !== idx))
  }

  async function handleVideos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    if (files.length > remainingVideos) {
      setError(`${MAX_VIDEOS} vidéos maximum — il reste ${remainingVideos} emplacement${remainingVideos > 1 ? 's' : ''}.`)
      return
    }
    const wrongType = files.find(f => f.type !== VIDEO_ACCEPTED)
    if (wrongType) {
      setError(`« ${wrongType.name} » n'est pas un MP4.`)
      return
    }
    const tooBig = files.find(f => f.size > MAX_VIDEO_SIZE)
    if (tooBig) {
      setError(`« ${tooBig.name} » dépasse 16 Mo — la limite WhatsApp pour une vidéo.`)
      return
    }

    setUploadingVideo(true)
    setError(null)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('videos', f))
      const res = await apiUpload(`/api/automations/${automation.id}/videos`, formData) as {
        urls?: string[]
        url?: string
        automation: Automation
      }
      // Prefer the server's own array; fall back to appending whatever URLs came back
      const returned = res.urls ?? (res.url ? [res.url] : [])
      const videoUrls = res.automation?.videoUrls ?? [...draft.videoUrls, ...returned]
      setDraft(d => ({ ...d, videoUrls }))
      setSaved(s => ({ ...s, videoUrls }))
      onSaved({ ...automation, videoUrls }, automation.id)
      onToast(files.length > 1 ? 'Vidéos ajoutées' : 'Vidéo ajoutée', true)
    } catch (err) {
      setError(apiErrorMessage(err, "L'envoi de la vidéo a échoué. Réessayez."))
      onToast("Erreur lors de l'envoi de la vidéo", false)
    } finally {
      setUploadingVideo(false)
    }
  }

  /** Removal is local — persisted with the next « Enregistrer » (PUT videoUrls). */
  function removeVideo(idx: number) {
    set('videoUrls', draft.videoUrls.filter((_, i) => i !== idx))
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">

      {/* Header — name + active toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
          <input
            type="text"
            autoFocus={autoFocus}
            value={draft.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ex : Rideaux Automatique"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div className="flex flex-col items-end gap-1.5 pt-6 shrink-0">
          <button
            type="button"
            onClick={() => set('isActive', !draft.isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${draft.isActive ? 'bg-emerald-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${draft.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-xs font-medium ${draft.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
            {draft.isActive ? 'Actif' : 'Inactif'}
          </span>
        </div>
      </div>

      {/* Trigger message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message pré-rempli déclencheur</label>
        <textarea
          value={draft.triggerMessage}
          onChange={e => set('triggerMessage', e.target.value)}
          rows={3}
          placeholder="Bonjour, je suis intéressé(e) par vos rideaux"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          Copiez-collez ici <strong>EXACTEMENT</strong> le message pré-rempli de votre pub Meta, sans le retaper.
          C'est ce message qui déclenche l'envoi automatique.
        </p>
      </div>

      {/* Welcome message */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Message de bienvenue / script</label>
          <span className="text-xs text-gray-400">{draft.welcomeMessage.length} caractères</span>
        </div>
        <textarea
          value={draft.welcomeMessage}
          onChange={e => set('welcomeMessage', e.target.value)}
          rows={5}
          placeholder="Bonjour 👋 Merci pour votre message ! Voici nos modèles…"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
      </div>

      {/* Photos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Photos envoyées avec le message</label>
          <span className="text-xs text-gray-400">{draft.photoUrls.length}/{MAX_PHOTOS}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {draft.photoUrls.map((url, idx) => (
            <div key={url + idx} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {remainingSlots > 0 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || isNew}
              title={isNew ? "Créez d'abord l'automatisation" : undefined}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-square hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-60 transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="h-6 w-6 text-gray-300" />
                  <span className="text-xs text-gray-400 text-center leading-tight">Ajouter<br />une photo</span>
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFiles}
        />

        <p className="text-xs text-gray-400 mt-1">
          {isNew
            ? "Créez d'abord l'automatisation — les photos pourront ensuite être ajoutées."
            : `JPEG · PNG · WebP · GIF — max 5 Mo par photo · ${MAX_PHOTOS} photos maximum. Les photos sont envoyées immédiatement ; une suppression prend effet à l'enregistrement.`}
        </p>
      </div>

      {/* PDF documents */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Fichier PDF envoyé avec le message</label>
          <span className="text-xs text-gray-400">{draft.documentUrls.length}/{MAX_DOCS}</span>
        </div>

        <div className="space-y-2">
          {draft.documentUrls.map((url, idx) => (
            <div key={url + idx} className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-0 truncate text-sm text-gray-700 hover:text-emerald-700"
              >
                {fileNameFromUrl(url)}
              </a>
              {sizes[url] > 0 && <span className="text-xs text-gray-400 shrink-0">{formatSize(sizes[url])}</span>}
              <button
                type="button"
                onClick={() => removeDoc(idx)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {remainingDocs > 0 && (
            <button
              type="button"
              onClick={() => docRef.current?.click()}
              disabled={uploadingDocs || isNew}
              title={isNew ? "Créez d'abord l'automatisation" : undefined}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-3 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-60 transition-colors"
            >
              {uploadingDocs ? (
                <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
              ) : (
                <>
                  <FilePlus className="h-5 w-5 text-gray-300" />
                  <span className="text-xs text-gray-400">Ajouter un PDF</span>
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={docRef}
          type="file"
          multiple
          accept={DOC_ACCEPTED}
          className="hidden"
          onChange={handleDocs}
        />

        <p className="text-xs text-gray-400 mt-1">
          {isNew
            ? "Créez d'abord l'automatisation — les PDF pourront ensuite être ajoutés."
            : `PDF uniquement — max 16 Mo par fichier · ${MAX_DOCS} fichiers maximum. Envoyés immédiatement ; une suppression prend effet à l'enregistrement.`}
        </p>
      </div>

      {/* Video */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Vidéos envoyées avec le message</label>
          <span className="text-xs text-gray-400">{draft.videoUrls.length}/{MAX_VIDEOS}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {draft.videoUrls.map((url, idx) => (
            <div key={url + idx} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
              <video src={url} controls preload="metadata" className="w-full h-full object-cover bg-black" />
              <button
                type="button"
                onClick={() => removeVideo(idx)}
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {remainingVideos > 0 && (
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              disabled={uploadingVideo || isNew}
              title={isNew ? "Créez d'abord l'automatisation" : undefined}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-square hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-60 transition-colors"
            >
              {uploadingVideo ? (
                <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
              ) : (
                <>
                  <Film className="h-6 w-6 text-gray-300" />
                  <span className="text-xs text-gray-400 text-center leading-tight">Ajouter<br />une vidéo</span>
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={videoRef}
          type="file"
          multiple
          accept={VIDEO_ACCEPTED}
          className="hidden"
          onChange={handleVideos}
        />

        <p className="text-xs text-gray-400 mt-1">
          {isNew
            ? "Créez d'abord l'automatisation — les vidéos pourront ensuite être ajoutées."
            : `MP4 uniquement — max 16 Mo par vidéo (limite WhatsApp) · ${MAX_VIDEOS} vidéos maximum. H.264 + AAC recommandé. Les vidéos sont envoyées immédiatement ; une suppression prend effet à l'enregistrement.`}
        </p>
      </div>

      {/* Follow-up message 2 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Message 2 (après vidéo/PDF)</label>
          <span className="text-xs text-gray-400">{draft.message2.length} caractères</span>
        </div>
        <textarea
          value={draft.message2}
          onChange={e => set('message2', e.target.value)}
          rows={5}
          placeholder="Voici le catalogue complet 📄 Dites-moi ce qui vous plaît !"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Optionnel — laissez vide pour ne rien envoyer.</p>
      </div>

      {/* Follow-up message 3 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Message 3 — question de qualification</label>
          <span className="text-xs text-gray-400">{draft.message3.length} caractères</span>
        </div>
        <textarea
          value={draft.message3}
          onChange={e => set('message3', e.target.value)}
          rows={5}
          placeholder="Pour quelle pièce cherchez-vous ? Et quelles dimensions ?"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Optionnel — laissez vide pour ne rien envoyer.</p>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* Actions */}
      {confirmDelete && !isNew ? (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 space-y-2.5">
          <p className="text-sm text-red-700">
            Supprimer « {draft.name.trim() || 'cette automatisation'} » ? Cette action est irréversible.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Supprimer définitivement'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => (isNew ? handleDelete() : setConfirmDelete(true))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            {isNew ? 'Annuler' : <><Trash2 className="h-4 w-4" />Supprimer</>}
          </button>
          <div className="flex items-center gap-3">
            {dirty && !isNew && <span className="text-xs text-amber-600">Modifications non enregistrées</span>}
            <button
              onClick={handleSave}
              disabled={saving || busy}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? (isNew ? 'Création…' : 'Enregistrement…') : (isNew ? 'Créer' : 'Enregistrer')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Empty-list placeholder, kept next to the card it invites you to create. */
export function AutomationsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
        <Zap className="h-6 w-6 text-emerald-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">Aucune automatisation</p>
        <p className="text-sm text-gray-500 mt-0.5">
          Créez-en une par pub Meta : le message pré-rempli déclenche l'envoi automatique.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
      >
        + Nouvelle automatisation
      </button>
    </div>
  )
}
