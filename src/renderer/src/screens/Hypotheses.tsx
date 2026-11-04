import { Plus, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { HYPOTHESIS_TYPES, type Hypothesis, type HypothesisType } from '../../../shared/schema'
import { HypothesisDialog } from '@/components/HypothesisDialog'
import { StatusChip } from '@/components/StatusChip'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RISK_LABELS, TYPE_LABELS, tallyText } from '@/lib/discovery'

type Open = { hypothesis: Hypothesis | null; type: HypothesisType }

export function Hypotheses({
  onOpenInterview,
  onNotify,
  onError
}: {
  onOpenInterview: (id: string) => void
  onNotify: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [items, setItems] = useState<Hypothesis[] | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const reload = useCallback(() => window.api.listHypotheses().then(setItems, onError), [onError])
  useEffect(() => void reload(), [reload])

  if (!items) return null

  const starters = async () => {
    try {
      setItems(await window.api.addStarterHypotheses())
      onNotify('Added 3 starter hypotheses. Replace the [brackets] with your venture.')
    } catch (err) {
      onError(err)
    }
  }

  const addButton = (type: HypothesisType = 'customer', label = 'Add hypothesis') => (
    <Button variant="secondary" size="sm" onClick={() => setOpen({ hypothesis: null, type })}>
      <Plus aria-hidden strokeWidth={1.5} />
      {label}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 && (
        <Card>
          <p>No hypotheses yet. Write down what must be true for your venture to work, then test it in interviews.</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={starters}>
              <Sparkles aria-hidden strokeWidth={1.5} />
              Start with 3 templates
            </Button>
            {addButton()}
          </div>
        </Card>
      )}

      {items.length > 0 &&
        HYPOTHESIS_TYPES.map((type) => {
          const group = items.filter((h) => h.type === type)
          return (
            <section key={type} aria-labelledby={`type-${type}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 id={`type-${type}`} className="text-xl font-semibold">
                  {TYPE_LABELS[type]} <span className="tabular text-[15px] font-normal text-muted-foreground">({group.length})</span>
                </h2>
                {addButton(type, `Add ${TYPE_LABELS[type].toLowerCase()} hypothesis`)}
              </div>
              {group.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 gap-3">
                  {group.map((h) => (
                    <li key={h.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setOpen({ hypothesis: h, type })}
                        className="text-left font-semibold break-words text-primary underline-offset-2 hover:underline"
                      >
                        {h.statement}
                      </button>
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <StatusChip status={h.status} />
                        <span>{RISK_LABELS[h.risk]}</span>
                      </div>
                      <p className="tabular text-[13px]">{tallyText(h.tally)}</p>
                      {h.suggested !== h.status && (
                        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                          Evidence suggests <StatusChip status={h.suggested} />
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}

      {open && (
        <HypothesisDialog
          key={open.hypothesis?.id ?? 'new'}
          hypothesis={open.hypothesis}
          defaultType={open.type}
          onClose={() => setOpen(null)}
          onSaved={(h) => {
            setOpen(null)
            onNotify('Hypothesis saved')
            setItems(items.some((x) => x.id === h.id) ? items.map((x) => (x.id === h.id ? h : x)) : [...items, h])
          }}
          onDeleted={(id) => {
            setOpen(null)
            onNotify('Hypothesis deleted')
            setItems(items.filter((x) => x.id !== id))
          }}
          onOpenInterview={onOpenInterview}
          onError={onError}
        />
      )}
    </div>
  )
}
