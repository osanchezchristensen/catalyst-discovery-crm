import { Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import {
  HYPOTHESIS_STATUSES,
  HYPOTHESIS_TYPES,
  RISKS,
  hypothesisInput,
  type EvidenceLink,
  type Hypothesis,
  type HypothesisInput
} from '../../../shared/schema'
import { SelectField, TextAreaField } from './Field'
import { StatusChip } from './StatusChip'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { RISK_LABELS, STATUS_LABELS, TYPE_LABELS, VERDICT_LABELS, fieldErrors, formatDate, tallyText } from '@/lib/discovery'
import { focusFirstError } from '@/lib/utils'

/** Create (hypothesis = null) or edit a hypothesis, and drill into the interviews linked to it. */
export function HypothesisDialog({
  hypothesis,
  defaultType,
  onClose,
  onSaved,
  onDeleted,
  onOpenInterview,
  onError
}: {
  hypothesis: Hypothesis | null
  defaultType: HypothesisInput['type']
  onClose: () => void
  onSaved: (h: Hypothesis) => void
  onDeleted: (id: string) => void
  onOpenInterview: (id: string) => void
  onError: (err: unknown) => void
}) {
  const [draft, setDraft] = useState<HypothesisInput>(() =>
    hypothesis
      ? { ...hypothesis }
      : { type: defaultType, statement: '', risk: 'medium', status: 'untested', success_criteria: '' }
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [links, setLinks] = useState<EvidenceLink[]>([])

  useEffect(() => {
    if (hypothesis) window.api.listEvidence(hypothesis.id).then(setLinks, onError)
  }, [hypothesis, onError])

  const set = (patch: Partial<HypothesisInput>) => setDraft({ ...draft, ...patch })

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = hypothesisInput.safeParse(draft)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues))
      return focusFirstError(e.currentTarget)
    }
    setBusy(true)
    try {
      onSaved(await window.api.saveHypothesis(draft))
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!hypothesis) return
    const n = links.length
    const linked = n ? ` Its ${n} evidence ${n === 1 ? 'link' : 'links'} will be removed too.` : ''
    if (!window.confirm(`Delete this hypothesis?${linked} This can't be undone.`)) return
    try {
      await window.api.deleteHypothesis(hypothesis.id)
      onDeleted(hypothesis.id)
    } catch (err) {
      onError(err)
    }
  }

  const suggestion = hypothesis && hypothesis.suggested !== draft.status ? hypothesis.suggested : null

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        title={hypothesis ? 'Edit hypothesis' : 'New hypothesis'}
        description={hypothesis ? tallyText(hypothesis.tally) : 'Write one assumption you can test in interviews.'}
      >
        <form onSubmit={save} noValidate>
          <fieldset disabled={busy} className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <TextAreaField
                label="Statement"
                hint="Specific enough that an interview could prove it wrong."
                value={draft.statement}
                onChange={(e) => set({ statement: e.target.value })}
                error={errors.statement}
                maxLength={20000}
              />
            </div>
            <SelectField label="Type" value={draft.type} onChange={(e) => set({ type: e.target.value as HypothesisInput['type'] })}>
              {HYPOTHESIS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </SelectField>
            <SelectField label="Risk" value={draft.risk} onChange={(e) => set({ risk: e.target.value as HypothesisInput['risk'] })}>
              {RISKS.map((r) => (
                <option key={r} value={r}>
                  {RISK_LABELS[r]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Status"
              value={draft.status}
              onChange={(e) => set({ status: e.target.value as HypothesisInput['status'] })}
            >
              {HYPOTHESIS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </SelectField>
            {suggestion && (
              <p className="col-span-3 flex flex-wrap items-center gap-2 text-[13px]">
                Evidence suggests <StatusChip status={suggestion} />
                <Button variant="secondary" size="sm" onClick={() => set({ status: suggestion })}>
                  Apply suggestion
                </Button>
              </p>
            )}
            <div className="col-span-3">
              <TextAreaField
                label="Success criteria"
                hint="What would you need to hear to call this validated?"
                value={draft.success_criteria}
                onChange={(e) => set({ success_criteria: e.target.value })}
                maxLength={20000}
              />
            </div>
          </fieldset>

          {hypothesis && (
            <>
              <h3 className="mt-6 font-semibold">Linked interviews</h3>
              {links.length === 0 ? (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  No evidence yet. Link this hypothesis from an interview&apos;s Evidence section.
                </p>
              ) : (
                <ul className="mt-1 flex flex-col gap-2">
                  {links.map((l) => (
                    <li key={l.interview_id} className="flex flex-wrap items-baseline gap-x-2">
                      <button
                        type="button"
                        className="tabular text-primary underline-offset-2 hover:underline"
                        onClick={() => onOpenInterview(l.interview_id)}
                      >
                        {formatDate(l.date)}
                      </button>
                      <span>{l.contact_name ?? 'No contact'}:</span>
                      <span className="font-semibold">{VERDICT_LABELS[l.verdict]}</span>
                      {l.note && <span className="w-full break-words text-[13px] text-muted-foreground">{l.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            {hypothesis ? (
              <Button variant="ghost-destructive" onClick={remove} disabled={busy}>
                <Trash2 aria-hidden strokeWidth={1.5} />
                Delete hypothesis
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save hypothesis'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
