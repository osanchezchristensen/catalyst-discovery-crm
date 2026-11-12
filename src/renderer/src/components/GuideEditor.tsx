import { AlertCircle, ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { QUESTION_BANK, REFERRAL_QUESTION, questionTips } from '../../../shared/guides'
import { guideInput, type Guide } from '../../../shared/schema'
import { TextField } from './Field'
import { Button } from './ui/button'
import { Card, CardTitle } from './ui/card'
import { fieldErrors } from '@/lib/discovery'
import { focusFirstError } from '@/lib/utils'

/** Build an interview guide: questions in order, each checked for yes/no, hypothetical or leading wording. */
export function GuideEditor({
  guide,
  onClose,
  onSaved,
  onDeleted,
  onDirtyChange,
  onError
}: {
  guide: Guide | null
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  onSaved: (g: Guide) => void
  onDeleted: (id: string) => void
  onError: (err: unknown) => void
}) {
  const [name, setName] = useState(guide?.name ?? '')
  const initial = guide?.questions ?? [REFERRAL_QUESTION]
  const [questions, setQuestions] = useState<string[]>(initial)
  const [draft, setDraft] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const dirty = name !== (guide?.name ?? '') || JSON.stringify(questions) !== JSON.stringify(initial)
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  // New questions go above the referral question while it is last, so it stays the closing question.
  const add = (q: string) => {
    if (!q.trim()) return
    const keepLast = questions[questions.length - 1] === REFERRAL_QUESTION
    setQuestions(keepLast ? [...questions.slice(0, -1), q.trim(), REFERRAL_QUESTION] : [...questions, q.trim()])
  }
  const move = (i: number, by: -1 | 1) => {
    const next = [...questions]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setQuestions(next)
  }

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = { id: guide?.id, name, questions }
    const parsed = guideInput.safeParse(input)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues))
      return focusFirstError(e.currentTarget)
    }
    setBusy(true)
    try {
      onSaved(await window.api.saveGuide(input))
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!guide || !window.confirm(`Delete the guide "${guide.name}"? This can't be undone.`)) return
    try {
      await window.api.deleteGuide(guide.id)
      onDeleted(guide.id)
    } catch (err) {
      onError(err)
    }
  }

  const unused = QUESTION_BANK.filter((q) => !questions.includes(q))

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <Card>
        <CardTitle>{guide ? 'Edit guide' : 'New guide'}</CardTitle>
        <div className="mt-4 max-w-md">
          <TextField label="Guide name" placeholder="First calls with freshmen…" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={200} />
        </div>

        <h3 className="mt-6 font-semibold">Questions</h3>
        {questions.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted-foreground">No questions yet. Write your own or add some from the bank below.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {questions.map((q, i) => {
              const tips = questionTips(q)
              return (
                <li key={`${i}-${q}`} className="rounded-md border border-border p-2">
                  <div className="flex items-start gap-2">
                    <span className="tabular w-6 shrink-0 pt-1.5 text-right text-[13px] text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1 pt-1 break-words">{q}</span>
                    <Button variant="ghost" size="icon" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp aria-hidden strokeWidth={1.5} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move question ${i + 1} down`}
                      disabled={i === questions.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown aria-hidden strokeWidth={1.5} />
                    </Button>
                    <Button
                      variant="ghost-destructive"
                      size="icon"
                      aria-label={`Remove question ${i + 1}`}
                      onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                    >
                      <X aria-hidden strokeWidth={1.5} />
                    </Button>
                  </div>
                  {tips.map((t) => (
                    <p key={t.key} className="mt-1 ml-8 flex items-start gap-1 text-[13px]">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                      <span>
                        <span className="font-semibold">Tip:</span> {t.tip}
                      </span>
                    </p>
                  ))}
                </li>
              )
            })}
          </ol>
        )}
        {errors.questions && <p className="mt-2 text-[13px] font-semibold">{errors.questions}</p>}

        <div className="mt-4 flex items-start gap-2">
          <div className="flex-1">
            <TextField
              label="New question"
              hideLabel
              placeholder="Tell me about the last time…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add(draft)
                  setDraft('')
                }
              }}
              maxLength={500}
            />
            {draft.trim() &&
              questionTips(draft).map((t) => (
                <p key={t.key} className="mt-1 flex items-start gap-1 text-[13px]" aria-live="polite">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                  <span>
                    <span className="font-semibold">Tip:</span> {t.tip}
                  </span>
                </p>
              ))}
          </div>
          <Button
            variant="secondary"
            disabled={!draft.trim()}
            onClick={() => {
              add(draft)
              setDraft('')
            }}
          >
            <Plus aria-hidden strokeWidth={1.5} />
            Add question
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Question bank</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Questions about what people did, not what they would do. Replace the [brackets] after adding.
        </p>
        <ul className="mt-3 flex flex-col gap-1">
          {unused.map((q) => (
            <li key={q} className="flex items-center justify-between gap-2">
              <span className="break-words">{q}</span>
              <Button variant="ghost" size="sm" aria-label={`Add "${q}"`} onClick={() => add(q)}>
                <Plus aria-hidden strokeWidth={1.5} />
                Add
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-4 border-t border-border bg-background px-6 py-3">
        {guide ? (
          <Button variant="ghost-destructive" onClick={remove} disabled={busy}>
            <Trash2 aria-hidden strokeWidth={1.5} />
            Delete guide
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => (!dirty || window.confirm('Discard your changes to this guide?')) && onClose()}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save guide'}
          </Button>
        </div>
      </div>
    </form>
  )
}
