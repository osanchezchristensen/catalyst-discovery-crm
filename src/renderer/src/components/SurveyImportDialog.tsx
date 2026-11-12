import { useEffect, useState } from 'react'
import type { SurveyCsvFile, SurveyImportPreview } from '../../../shared/api'
import { INTERVIEW_TYPES, SURVEY_SECTIONS, type InterviewType, type SurveyMapping } from '../../../shared/schema'
import { SelectField } from './Field'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { INTERVIEW_TYPE_LABELS, NOTE_FIELDS } from '@/lib/discovery'

type Section = (typeof SURVEY_SECTIONS)[number]
const SECTION_LABELS: Record<Section, string> = {
  ...(Object.fromEntries(NOTE_FIELDS.map((f) => [f.key, f.label])) as Record<Exclude<Section, 'quotes'>, string>),
  quotes: 'Key quotes'
}
type Identity = 'name' | 'email' | 'date'
const IDENTITY: { key: Identity; label: string; none: string }[] = [
  { key: 'name', label: 'Respondent name', none: 'Not in this file' },
  { key: 'email', label: 'Respondent email', none: 'Not in this file' },
  { key: 'date', label: 'Date answered', none: 'Use today' }
]

/** Turn each survey response into a Written response interview: pick who, when, and where each answer goes. */
export function SurveyImportDialog({
  file,
  onClose,
  onDone,
  onError
}: {
  file: SurveyCsvFile
  onClose: () => void
  onDone: (result: { interviews: number; contacts: number }) => void
  onError: (err: unknown) => void
}) {
  const [who, setWho] = useState<Record<Identity, number | null>>({ name: file.mapping.name, email: file.mapping.email, date: file.mapping.date })
  const [type, setType] = useState<InterviewType>(file.mapping.type)
  // Every column starts as an answer in its suggested section or skipped; identity columns are left out below.
  const [sections, setSections] = useState<Record<number, Section | 'skip'>>(() =>
    Object.fromEntries(file.headers.map((_, i) => [i, file.mapping.answers.find((a) => a.col === i)?.section ?? 'skip']))
  )
  const [answer, setAnswer] = useState<{ key: string; preview: SurveyImportPreview } | null>(null)
  const [busy, setBusy] = useState(false)

  const identityCols = new Set(Object.values(who))
  const answerCols = file.headers.map((_, i) => i).filter((i) => !identityCols.has(i))
  const answers = answerCols.flatMap((col) => (sections[col] === 'skip' ? [] : [{ col, section: sections[col] as Section }]))
  const mapping: SurveyMapping = { ...who, type, answers }
  const request = answers.length ? { token: file.token, mapping } : null
  const key = JSON.stringify(request)
  useEffect(() => {
    const req = JSON.parse(key)
    if (req) window.api.previewSurveyImport(req).then((preview) => setAnswer({ key, preview }), onError)
  }, [key, onError])
  const preview = answer?.key === key ? answer.preview : null

  const cancel = () => {
    void window.api.cancelSurveyImport(file.token)
    onClose()
  }
  const apply = async () => {
    if (!request) return
    setBusy(true)
    try {
      onDone(await window.api.applySurveyImport(request))
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  const sample = (col: number) => file.sample.map((r) => r[col]).find((v) => v) ?? ''
  const header = (i: number) => file.headers[i] || `Column ${i + 1}`

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && cancel()}>
      <DialogContent
        title="Import survey answers"
        description={`${file.fileName}: ${file.rowCount} ${file.rowCount === 1 ? 'response' : 'responses'}. Each response becomes a Written response interview.`}
      >
        <fieldset disabled={busy} className="grid grid-cols-2 gap-3">
          {IDENTITY.map((f) => (
            <SelectField
              key={f.key}
              label={f.label}
              value={who[f.key] ?? ''}
              onChange={(e) => setWho({ ...who, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">{f.none}</option>
              {file.headers.map((_, i) => (
                <option key={i} value={i}>
                  {header(i).slice(0, 40)}
                  {sample(i) ? ` (e.g. ${sample(i).slice(0, 24)})` : ''}
                </option>
              ))}
            </SelectField>
          ))}
          <SelectField label="Interview type" value={type} onChange={(e) => setType(e.target.value as InterviewType)}>
            {INTERVIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {INTERVIEW_TYPE_LABELS[t].label}
              </option>
            ))}
          </SelectField>
        </fieldset>

        <fieldset disabled={busy} className="mt-4">
          <legend className="text-[13px] font-semibold">Where each answer goes</legend>
          <p className="text-[13px] text-muted-foreground">The question is kept in bold above each answer in your notes.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {answerCols.map((i) => (
              <li key={i} className="grid grid-cols-[1fr_11rem] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold" title={header(i)}>
                    {header(i)}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">{sample(i) || 'No answer in the first rows'}</p>
                </div>
                <SelectField
                  label={`Section for “${header(i)}”`}
                  hideLabel
                  value={sections[i]}
                  onChange={(e) => setSections({ ...sections, [i]: e.target.value as Section | 'skip' })}
                >
                  <option value="skip">Skip</option>
                  {SURVEY_SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      {SECTION_LABELS[s]}
                    </option>
                  ))}
                </SelectField>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="mt-4 rounded-md bg-secondary px-3 py-2" aria-live="polite">
          {!request ? (
            <p>Pick a section for at least one question.</p>
          ) : !preview ? (
            <p>Checking…</p>
          ) : (
            <>
              <p className="tabular font-semibold">
                {preview.interviews} {preview.interviews === 1 ? 'interview' : 'interviews'}
                {preview.newContacts > 0 && `, ${preview.newContacts} new ${preview.newContacts === 1 ? 'contact' : 'contacts'}`}
              </p>
              <ul className="tabular text-[13px]">
                {preview.duplicates > 0 && <li>{preview.duplicates} skipped: already imported (same person, same date)</li>}
                {preview.empty > 0 && <li>{preview.empty} skipped: no answers</li>}
                {preview.invalid.map((i) => (
                  <li key={i.row}>
                    Row {i.row} skipped: {i.message}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[13px] text-muted-foreground">
                People are matched to contacts by email, then by name. A backup is taken first.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || !preview || preview.interviews === 0}>
            {busy ? 'Importing…' : preview ? `Import ${preview.interviews}` : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
