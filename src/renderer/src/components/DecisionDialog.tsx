import { useState, type FormEvent } from 'react'
import { DECISIONS, decisionInput, type Decision, type DecisionInput, type Hypothesis } from '../../../shared/schema'
import { TextAreaField, TextField } from './Field'
import { StatusChip } from './StatusChip'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { DECISION_HELP, DECISION_LABELS, fieldErrors, tallyText, today } from '@/lib/discovery'
import { focusFirstError } from '@/lib/utils'

/** Record Persevere, Pivot, Pause or Stop, citing the hypotheses behind it. */
export function DecisionDialog({
  hypotheses,
  onClose,
  onRecorded,
  onError
}: {
  hypotheses: Hypothesis[]
  onClose: () => void
  onRecorded: (d: Decision) => void
  onError: (err: unknown) => void
}) {
  const [draft, setDraft] = useState<DecisionInput>({ decision: 'persevere', rationale: '', decided_at: today(), hypothesis_ids: [] })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<DecisionInput>) => setDraft({ ...draft, ...patch })
  const version = hypotheses[0]?.version ?? 1

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = decisionInput.safeParse(draft)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues))
      return focusFirstError(e.currentTarget)
    }
    setBusy(true)
    try {
      onRecorded(await window.api.recordDecision(draft))
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent title="Record a decision" description="Decide on evidence, not hope. Your future self will read this.">
        <form onSubmit={save} noValidate>
          <fieldset disabled={busy} className="flex flex-col gap-4">
            <fieldset>
              <legend className="text-[13px] font-semibold">Decision</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {DECISIONS.map((d) => (
                  <label
                    key={d}
                    className="grid grid-cols-[auto_1fr] items-start gap-x-2 rounded-md border border-border p-2 has-[:checked]:border-primary has-[:checked]:bg-secondary"
                  >
                    <input
                      type="radio"
                      name="decision"
                      className="mt-1 size-4 accent-primary"
                      checked={draft.decision === d}
                      onChange={() => set({ decision: d })}
                    />
                    <span className="font-semibold">{DECISION_LABELS[d]}</span>
                    <span className="col-start-2 text-[13px] text-muted-foreground">{DECISION_HELP[d]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {draft.decision === 'pivot' && hypotheses.length > 0 && (
              <p className="rounded-md bg-secondary px-3 py-2 text-[13px]">
                Your hypotheses will be copied into version {version + 1} for you to rewrite. Evidence stays with version {version}.
              </p>
            )}
            <div className="w-44">
              <TextField
                label="Date"
                type="date"
                value={draft.decided_at}
                onChange={(e) => set({ decided_at: e.target.value })}
                error={errors.decided_at}
              />
            </div>
            <TextAreaField
              label="Rationale"
              hint="What did the interviews show? Cite numbers."
              value={draft.rationale}
              onChange={(e) => set({ rationale: e.target.value })}
              error={errors.rationale}
              maxLength={20000}
            />
            <fieldset>
              <legend className="text-[13px] font-semibold">Hypotheses behind this decision</legend>
              {hypotheses.length === 0 ? (
                <p className="mt-1 text-[13px] text-muted-foreground">No hypotheses yet.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-2">
                  {hypotheses.map((h) => (
                    <li key={h.id}>
                      <label className="grid grid-cols-[auto_1fr] items-start gap-x-2">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-primary"
                          checked={draft.hypothesis_ids.includes(h.id)}
                          onChange={(e) =>
                            set({
                              hypothesis_ids: e.target.checked
                                ? [...draft.hypothesis_ids, h.id]
                                : draft.hypothesis_ids.filter((x) => x !== h.id)
                            })
                          }
                        />
                        <span className="min-w-0 break-words">{h.statement}</span>
                        <span className="col-start-2 mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                          <StatusChip status={h.status} />
                          <span className="tabular">{tallyText(h.tally)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </fieldset>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Record decision'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
