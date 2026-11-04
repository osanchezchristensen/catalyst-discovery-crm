import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { insightInput, type Insight, type InsightInput } from '../../../shared/schema'
import { TextAreaField, TextField } from './Field'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { fieldErrors } from '@/lib/discovery'
import { focusFirstError } from '@/lib/utils'

export const splitTags = (text: string) => [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]

/** Create or edit one insight. `draft` carries the interview it belongs to and any highlighted text. */
export function InsightDialog({
  insight,
  draft: initial,
  onClose,
  onSaved,
  onDeleted,
  onError
}: {
  insight: Insight | null
  draft?: Partial<InsightInput>
  onClose: () => void
  onSaved: (n: Insight) => void
  onDeleted?: (id: string) => void
  onError: (err: unknown) => void
}) {
  const [text, setText] = useState(insight?.text ?? initial?.text ?? '')
  const [tagText, setTagText] = useState((insight?.tags ?? initial?.tags ?? []).join(', '))
  const [isQuote, setIsQuote] = useState(insight?.is_quote ?? initial?.is_quote ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input: InsightInput = {
      id: insight?.id,
      interview_id: insight ? insight.interview_id : (initial?.interview_id ?? null),
      text,
      tags: splitTags(tagText),
      is_quote: isQuote
    }
    const parsed = insightInput.safeParse(input)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues))
      return focusFirstError(e.currentTarget)
    }
    setBusy(true)
    try {
      onSaved(await window.api.saveInsight(input))
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!insight || !window.confirm("Delete this insight? This can't be undone.")) return
    try {
      await window.api.deleteInsight(insight.id)
      onDeleted?.(insight.id)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent title={insight ? 'Edit insight' : 'New insight'} description="One finding, in their words or yours.">
        <form onSubmit={save} noValidate>
          <fieldset disabled={busy} className="flex flex-col gap-3">
            <TextAreaField
              label="Insight"
              value={text}
              onChange={(e) => setText(e.target.value)}
              error={errors.text}
              maxLength={20000}
            />
            <TextField
              label="Tags"
              hint="Separate with commas. Reuse tags so patterns add up."
              placeholder="cost, late night…"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              error={errors.tags ?? errors['tags.0']}
            />
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" className="size-4 accent-primary" checked={isQuote} onChange={(e) => setIsQuote(e.target.checked)} />
              Exact quote
            </label>
          </fieldset>
          <div className="mt-6 flex items-center justify-between gap-2">
            {insight ? (
              <Button variant="ghost-destructive" onClick={remove} disabled={busy}>
                <Trash2 aria-hidden strokeWidth={1.5} />
                Delete insight
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save insight'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
