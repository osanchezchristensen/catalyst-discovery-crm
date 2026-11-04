import { useEffect, useState } from 'react'
import type { ContactCsvFile, ContactImportPreview } from '../../../shared/api'
import { CONTACT_FIELDS, type ContactField, type ContactMapping, type Segment } from '../../../shared/schema'
import { SelectField } from './Field'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

const FIELD_LABELS: Record<ContactField, string> = {
  name: 'Name (required)',
  email: 'Email',
  phone: 'Phone',
  role: 'Role',
  organization: 'Organization',
  tags: 'Tags',
  notes: 'Notes'
}

/** Map CSV columns to contact fields, preview what will happen, then import. */
export function ContactImportDialog({
  file,
  segments,
  onClose,
  onDone,
  onError
}: {
  file: ContactCsvFile
  segments: Segment[]
  onClose: () => void
  onDone: (added: number) => void
  onError: (err: unknown) => void
}) {
  const [mapping, setMapping] = useState<Record<ContactField, number | null>>(() =>
    Object.fromEntries(CONTACT_FIELDS.map((f) => [f, file.mapping[f] ?? null])) as Record<ContactField, number | null>
  )
  const [segmentId, setSegmentId] = useState<string | null>(null)
  // Each preview remembers the request it answers, so a stale answer is never shown.
  const [answer, setAnswer] = useState<{ key: string; preview: ContactImportPreview } | null>(null)
  const [busy, setBusy] = useState(false)

  const request = mapping.name === null ? null : { token: file.token, mapping: mapping as ContactMapping, segment_id: segmentId }
  const key = JSON.stringify(request)
  useEffect(() => {
    const req = JSON.parse(key)
    if (req) window.api.previewContactImport(req).then((preview) => setAnswer({ key, preview }), onError)
  }, [key, onError])
  const preview = answer?.key === key ? answer.preview : null

  const cancel = () => {
    void window.api.cancelContactImport(file.token)
    onClose()
  }
  const apply = async () => {
    if (!request) return
    setBusy(true)
    try {
      onDone((await window.api.applyContactImport(request)).added)
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  const sample = (col: number) => file.sample.map((r) => r[col]).find((v) => v) ?? ''

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && cancel()}>
      <DialogContent
        title="Import contacts from CSV"
        description={`${file.fileName}: ${file.rowCount} ${file.rowCount === 1 ? 'row' : 'rows'}. Pick which column holds each field.`}
      >
        <fieldset disabled={busy} className="grid grid-cols-2 gap-3">
          {CONTACT_FIELDS.map((f) => (
            <SelectField
              key={f}
              label={FIELD_LABELS[f]}
              value={mapping[f] ?? ''}
              onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">{f === 'name' ? 'Pick a column' : 'Not imported'}</option>
              {file.headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Column ${i + 1}`}
                  {sample(i) ? ` (e.g. ${sample(i).slice(0, 30)})` : ''}
                </option>
              ))}
            </SelectField>
          ))}
          <SelectField label="Put new contacts in segment" value={segmentId ?? ''} onChange={(e) => setSegmentId(e.target.value || null)}>
            <option value="">No segment</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </fieldset>

        <div className="mt-4 rounded-md bg-secondary px-3 py-2" aria-live="polite">
          {!request ? (
            <p>Pick the column that holds each contact&apos;s name.</p>
          ) : !preview ? (
            <p>Checking…</p>
          ) : (
            <>
              <p className="tabular font-semibold">
                {preview.add} new {preview.add === 1 ? 'contact' : 'contacts'}
              </p>
              <ul className="tabular text-[13px]">
                {preview.duplicates > 0 && <li>{preview.duplicates} skipped: same email as another contact</li>}
                {preview.noName > 0 && <li>{preview.noName} skipped: no name</li>}
                {preview.invalid.map((i) => (
                  <li key={i.row}>
                    Row {i.row} skipped: {i.message}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[13px] text-muted-foreground">New contacts start in Identified. A backup is taken first.</p>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || !preview || preview.add === 0}>
            {busy ? 'Importing…' : preview ? `Import ${preview.add}` : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
