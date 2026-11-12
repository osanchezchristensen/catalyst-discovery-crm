import { DatabaseBackup, FileDown, FileUp, FolderOpen, RotateCcw, Sheet, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { DEFAULT_THRESHOLDS } from '../../../shared/readiness'
import { profileInput, thresholdsInput, type Profile, type Thresholds } from '../../../shared/schema'
import { SelectField, STAGE_OPTIONS, TextField } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { TrashCard } from '@/components/TrashCard'
import { fieldErrors } from '@/lib/discovery'
import { focusFirstError, formatDateTime } from '@/lib/utils'

type ThresholdKey = keyof Thresholds
const THRESHOLD_FIELDS: { key: ThresholdKey; label: string; percent?: boolean }[] = [
  { key: 'segments', label: 'Customer segments identified' },
  { key: 'beachheadInterviews', label: 'Interviews in the beachhead' },
  { key: 'riskiest', label: 'Riskiest hypotheses to cover' },
  { key: 'interviewsPerHypothesis', label: 'Interviews per risky hypothesis' },
  { key: 'painScore', label: 'Pain score that counts as strong (1–5)' },
  { key: 'painShare', label: 'Share of beachhead interviews at that pain (%)', percent: true },
  { key: 'wtpSignals', label: 'Interviews with a willingness-to-pay signal' }
]

const toText = (t: Thresholds) =>
  Object.fromEntries(THRESHOLD_FIELDS.map((f) => [f.key, String(f.percent ? Math.round(t[f.key] * 100) : t[f.key])])) as Record<
    ThresholdKey,
    string
  >

export function Settings({
  profile,
  ventureName,
  lastBackupAt,
  onBackup,
  onImportWorkspace,
  onImportContacts,
  onProfileSaved,
  onNotify,
  onError
}: {
  profile: Profile
  ventureName: string
  lastBackupAt: string | null
  onBackup: () => void
  onImportWorkspace: () => void
  onImportContacts: () => void
  onProfileSaved: () => void
  onNotify: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [me, setMe] = useState({ full_name: profile.full_name, email: profile.email ?? '', stage: profile.stage })
  const [meErrors, setMeErrors] = useState<Record<string, string>>({})
  const [thresholds, setThresholds] = useState<Record<ThresholdKey, string> | null>(null)
  const [tErrors, setTErrors] = useState<Record<string, string>>({})
  const [includeDetails, setIncludeDetails] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    window.api.getThresholds().then((t) => setThresholds(toText(t)), onError)
  }, [onError])

  const saveMe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = profileInput.safeParse(me)
    if (!parsed.success) {
      setMeErrors(fieldErrors(parsed.error.issues))
      return focusFirstError(e.currentTarget)
    }
    try {
      await window.api.saveProfile(me)
      setMeErrors({})
      onNotify('Profile saved')
      onProfileSaved()
    } catch (err) {
      onError(err)
    }
  }

  const saveThresholds = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!thresholds) return
    const values = Object.fromEntries(
      THRESHOLD_FIELDS.map((f) => [f.key, f.percent ? Number(thresholds[f.key]) / 100 : Number(thresholds[f.key])])
    )
    const parsed = thresholdsInput.safeParse(values)
    if (!parsed.success) {
      setTErrors(fieldErrors(parsed.error.issues))
      return focusFirstError(e.currentTarget)
    }
    try {
      setThresholds(toText(await window.api.saveThresholds(parsed.data)))
      setTErrors({})
      onNotify('Checklist thresholds saved')
    } catch (err) {
      onError(err)
    }
  }

  const exportJson = async () => {
    try {
      const r = await window.api.exportWorkspace({ includeContactDetails: includeDetails })
      if ('path' in r) onNotify(`Workspace exported to ${r.path}`)
    } catch (err) {
      onError(err)
    }
  }
  const exportCsv = async () => {
    try {
      const r = await window.api.exportCsv({ includeContactDetails: includeDetails })
      if ('path' in r) onNotify(`CSV files saved in ${r.path}`)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Profile</CardTitle>
        <form onSubmit={saveMe} noValidate className="mt-4 flex flex-col gap-3">
          <TextField
            label="Your name"
            autoComplete="name"
            value={me.full_name}
            onChange={(e) => setMe({ ...me, full_name: e.target.value })}
            error={meErrors.full_name}
            maxLength={200}
          />
          <TextField
            label="Email (optional)"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={me.email}
            onChange={(e) => setMe({ ...me, email: e.target.value })}
            error={meErrors.email}
            maxLength={200}
          />
          <SelectField label="Catalyst stage" value={me.stage} onChange={(e) => setMe({ ...me, stage: Number(e.target.value) })}>
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <div>
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Readiness checklist</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The goals behind the Viability checklist. They travel with your workspace file, so teammates see the same checklist.
        </p>
        {thresholds && (
          <form onSubmit={saveThresholds} noValidate className="mt-4 flex flex-col gap-2">
            {THRESHOLD_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_6rem] items-start gap-3">
                <span className="pt-2 text-[13px]">
                  {f.label}
                </span>
                <TextField
                  label={f.label}
                  hideLabel
                  type="number"
                  inputMode="numeric"
                  value={thresholds[f.key]}
                  onChange={(e) => setThresholds({ ...thresholds, [f.key]: e.target.value })}
                  error={tErrors[f.key]}
                />
              </div>
            ))}
            <div className="mt-2 flex gap-2">
              <Button type="submit">Save thresholds</Button>
              <Button variant="secondary" onClick={() => setThresholds(toText(DEFAULT_THRESHOLDS))}>
                <RotateCcw aria-hidden strokeWidth={1.5} />
                Use program defaults
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <CardTitle>Export</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          A workspace file moves your venture to another computer or to a teammate. CSV files open in a spreadsheet.
          Attachments stay on this computer.
        </p>
        <label className="mt-4 flex items-center gap-2 font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={includeDetails} onChange={(e) => setIncludeDetails(e.target.checked)} />
          Include contact emails and phone numbers
        </label>
        <p className="mt-1 ml-6 text-[13px] text-muted-foreground">Off by default to protect the people you interviewed.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportJson}>
            <FileDown aria-hidden strokeWidth={1.5} />
            Export workspace
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Sheet aria-hidden strokeWidth={1.5} />
            Export CSV files
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Import</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          You&apos;ll see what will change before anything is imported, and a backup is taken first.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onImportWorkspace}>
            <FileUp aria-hidden strokeWidth={1.5} />
            Import workspace
          </Button>
          <Button variant="secondary" onClick={onImportContacts}>
            <FileUp aria-hidden strokeWidth={1.5} />
            Import contacts from CSV
          </Button>
        </div>
      </Card>

      <TrashCard onNotify={onNotify} onError={onError} />

      <Card>
        <CardTitle>Backups</CardTitle>
        <p className="mt-2">
          Last backup: <span className="tabular font-semibold">{formatDateTime(lastBackupAt)}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onBackup}>
            <DatabaseBackup aria-hidden strokeWidth={1.5} />
            Back up now
          </Button>
          <Button variant="secondary" onClick={() => window.api.openDataFolder().catch(onError)}>
            <FolderOpen aria-hidden strokeWidth={1.5} />
            Open data folder
          </Button>
        </div>
      </Card>

      <Card className="border-destructive">
        <CardTitle>Reset workspace</CardTitle>
        <p className="mt-2">
          Deletes your venture, contacts, interviews and everything else on this computer, then starts over. A backup is
          taken first.
        </p>
        <Button variant="destructive" className="mt-4" onClick={() => setResetting(true)}>
          <Trash2 aria-hidden strokeWidth={1.5} />
          Reset workspace…
        </Button>
      </Card>

      {resetting && <ResetDialog ventureName={ventureName} onClose={() => setResetting(false)} onError={onError} />}
    </div>
  )
}

/** Typing the venture name is the safeguard: a reset can't happen with one stray click. */
export function ResetDialog({ ventureName, onClose, onError }: { ventureName: string; onClose: () => void; onError: (err: unknown) => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = typed.trim().toLowerCase() === ventureName.trim().toLowerCase()

  const reset = async (e: FormEvent) => {
    e.preventDefault()
    if (!matches) return
    setBusy(true)
    try {
      await window.api.resetWorkspace(typed)
      // The app reloads to the Welcome screen through the data-changed event.
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent title="Reset workspace?" description="This deletes everything in the app on this computer. A backup is taken first.">
        <form onSubmit={reset} noValidate>
          <TextField
            label={`Type "${ventureName}" to confirm`}
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={200}
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || busy}>
              {busy ? 'Resetting…' : 'Delete everything and reset'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
