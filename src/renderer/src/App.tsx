import { useCallback, useEffect, useState } from 'react'
import type { ContactCsvFile, ImportPreview } from '../../shared/api'
import type { Profile, VentureBundle } from '../../shared/schema'
import { AboutDialog } from '@/components/AboutDialog'
import { ContactImportDialog } from '@/components/ContactImportDialog'
import { ImportPreviewDialog } from '@/components/ImportPreviewDialog'
import { Sidebar, type Screen } from '@/components/Sidebar'
import { StatusRegion, type Status } from '@/components/StatusRegion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { errorMessage } from '@/lib/utils'
import { Contacts } from '@/screens/Contacts'
import { Home } from '@/screens/Home'
import { Hypotheses } from '@/screens/Hypotheses'
import { Insights } from '@/screens/Insights'
import { InterviewEditor } from '@/screens/InterviewEditor'
import { Interviews } from '@/screens/Interviews'
import { VentureOverview } from '@/screens/VentureOverview'
import { Settings } from '@/screens/Settings'
import { Viability } from '@/screens/Viability'
import { Welcome } from '@/screens/Welcome'

const TITLES: Record<Screen, string> = { home: 'Home', venture: 'Venture', contacts: 'Contacts', hypotheses: 'Hypotheses', interviews: 'Interviews', insights: 'Insights', viability: 'Viability', settings: 'Settings' }
const api = window.api

export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [venture, setVenture] = useState<VentureBundle | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [status, setStatus] = useState<Status | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [csvFile, setCsvFile] = useState<ContactCsvFile | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  // The interview being edited (id null = new); `n` gives each open a fresh editor.
  const [editing, setEditing] = useState<{ id: string | null; n: number } | null>(null)
  // Bumped on every reload so the venture form drops its draft for the fresh data (e.g. after an import).
  const [loads, setLoads] = useState(0)

  const notify = useCallback(
    (tone: Status['tone'], message: string) => setStatus({ tone, message, key: Date.now() }),
    []
  )
  const onError = useCallback((err: unknown) => notify('error', errorMessage(err)), [notify])
  const dismiss = useCallback(() => setStatus(null), [])

  // Also used by the menu shortcut (Ctrl/Cmd+N); the event listener re-subscribes when it changes.
  const openInterview = useCallback(
    (id: string | null) => {
      if (unsaved && !window.confirm('You have unsaved changes. Leave without saving?')) return
      setScreen('interviews')
      setEditing({ id, n: Date.now() })
    },
    [unsaved]
  )

  const importContacts = useCallback(async () => {
    try {
      const r = await api.pickContactsCsv()
      if ('token' in r) setCsvFile(r)
    } catch (err) {
      onError(err)
    }
  }, [onError])

  const load = useCallback(
    () =>
      Promise.all([api.getProfile(), api.getActiveVenture(), api.getAppInfo()])
        .then(([p, v, info]) => {
          setProfile(p)
          setVenture(v)
          setLoads((n) => n + 1)
          setLastBackupAt(info.lastBackupAt)
          setLoadError(null)
          setLoaded(true)
        })
        .catch((err: unknown) => {
          // Never fall through to Welcome on a failed first load: it would create a second venture.
          setLoadError(errorMessage(err))
          onError(err)
        }),
    [onError]
  )

  useEffect(() => {
    void load()
  }, [load])

  // Kept apart from the initial load: this re-subscribes whenever openInterview changes.
  useEffect(() => {
    return api.onEvent((event) => {
      switch (event.type) {
        case 'about':
          setAboutOpen(true)
          break
        case 'import-preview':
          setPreview(event.preview)
          break
        case 'status':
          notify(event.tone, event.message)
          if (event.tone === 'success') void api.getAppInfo().then((i) => setLastBackupAt(i.lastBackupAt))
          break
        case 'data-changed':
          void load()
          break
        case 'log-interview':
          openInterview(null)
          break
        case 'import-contacts':
          void importContacts()
          break
      }
    })
  }, [load, notify, openInterview, importContacts])

  // The venture form and the interview editor report unsaved edits; ask before leaving them.
  // Closing the window is caught here; main asks the user (will-prevent-unload).
  useEffect(() => {
    if (!unsaved) return
    const block = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', block)
    return () => window.removeEventListener('beforeunload', block)
  }, [unsaved])
  const confirmLeave = () => !unsaved || window.confirm('You have unsaved changes. Leave without saving?')
  const navigate = (next: Screen) => {
    if (next === screen && !editing) return
    if (!confirmLeave()) return
    setEditing(null)
    setScreen(next)
  }
  const toastSuccess = useCallback((m: string) => notify('success', m), [notify])
  const closeEditor = useCallback(() => setEditing(null), [])
  const pickImport = async () => {
    try {
      const r = await api.pickImport()
      if ('token' in r) setPreview(r)
    } catch (err) {
      onError(err)
    }
  }
  const backup = async () => {
    try {
      setLastBackupAt((await api.backupNow()).at)
      notify('success', 'Backup saved')
    } catch (err) {
      onError(err)
    }
  }

  const dialogs = (
    <>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} onError={onError} />
      <ImportPreviewDialog
        preview={preview}
        unsaved={unsaved}
        onClose={() => setPreview(null)}
        onApplied={(m) => notify('success', m)}
        onError={onError}
      />
      {csvFile && venture && (
        <ContactImportDialog
          key={csvFile.token}
          file={csvFile}
          segments={venture.segments}
          onClose={() => setCsvFile(null)}
          onDone={(added) => {
            setCsvFile(null)
            notify('success', `Imported ${added} ${added === 1 ? 'contact' : 'contacts'}`)
          }}
          onError={onError}
        />
      )}
      <StatusRegion status={status} onDismiss={dismiss} />
    </>
  )

  if (!loaded) {
    if (!loadError) return null
    return (
      <main className="flex min-h-full items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <h1 className="font-heading text-2xl font-semibold">Your data couldn’t be opened</h1>
          <p className="mt-2 break-words">{loadError}</p>
          <Button className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </Card>
      </main>
    )
  }

  if (!profile || !venture) {
    return (
      <>
        <Welcome profile={profile} hasVenture={!!venture} onDone={load} onImport={pickImport} onError={onError} />
        {dialogs}
      </>
    )
  }

  return (
    <div className="flex h-full">
      <button
        type="button"
        onClick={() => document.getElementById('main')?.focus()}
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </button>
      <Sidebar screen={screen} onNavigate={navigate} ventureName={venture.venture.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
          <h1 className="font-heading text-2xl font-semibold">{TITLES[screen]}</h1>
        </header>
        <main id="main" tabIndex={-1} className="relative flex-1 scroll-pb-24 overflow-auto">
          <div className="mx-auto max-w-[1280px] p-6">
            {screen === 'home' ? (
              <Home key={loads} lastBackupAt={lastBackupAt} onBackup={backup} onOpenInterview={openInterview} onNotify={toastSuccess} onError={onError} />
            ) : screen === 'contacts' ? (
              <Contacts
                key={loads}
                segments={venture.segments}
                onOpenInterview={openInterview}
                onNotify={toastSuccess}
                onError={onError}
              />
            ) : screen === 'settings' ? (
              <Settings
                key={loads}
                profile={profile}
                ventureName={venture.venture.name}
                lastBackupAt={lastBackupAt}
                onBackup={backup}
                onImportWorkspace={pickImport}
                onImportContacts={importContacts}
                onProfileSaved={load}
                onNotify={toastSuccess}
                onError={onError}
              />
            ) : screen === 'insights' ? (
              <Insights key={loads} onOpenInterview={openInterview} onNotify={toastSuccess} onError={onError} />
            ) : screen === 'viability' ? (
              <Viability key={loads} onNotify={toastSuccess} onError={onError} />
            ) : screen === 'hypotheses' ? (
              <Hypotheses key={loads} onOpenInterview={openInterview} onNotify={toastSuccess} onError={onError} />
            ) : screen === 'interviews' && editing ? (
              <InterviewEditor
                key={`${loads}-${editing.n}`}
                id={editing.id}
                team={venture.members.map((m) => m.name)}
                onBack={closeEditor}
                onDirtyChange={setUnsaved}
                onNotify={toastSuccess}
                onError={onError}
              />
            ) : screen === 'interviews' ? (
              <Interviews key={loads} onOpen={openInterview} onNotify={toastSuccess} onDirtyChange={setUnsaved} confirmLeave={confirmLeave} onError={onError} />
            ) : (
              <VentureOverview
                key={`${loads}-${venture.venture.updated_at}`}
                bundle={venture}
                onSaved={(b) => {
                  setVenture(b)
                  notify('success', 'Venture saved')
                }}
                onError={onError}
                onDirtyChange={setUnsaved}
              />
            )}
          </div>
        </main>
      </div>
      {dialogs}
    </div>
  )
}
