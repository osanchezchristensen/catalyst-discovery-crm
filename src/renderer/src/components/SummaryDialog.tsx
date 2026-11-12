import { Circle, CircleCheck, FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dashboard, Insight, VentureBundle } from '../../../shared/schema'
import { today } from '../../../shared/dates'
import { StatusChip } from '@/components/StatusChip'
import { Wordmark } from '@/components/Wordmark'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DECISION_LABELS, RISK_LABELS, formatDate, tallyText } from '@/lib/discovery'

const RISK_ORDER = { high: 0, medium: 1, low: 2 }
// Counts that keep the sheet on one page; the sheet also clips at the page height.
const MAX_HYPOTHESES = 5
const MAX_QUOTES = 3

type Data = { dash: Dashboard; quotes: Insight[] }

/** One Letter page (backlog #12). The same markup is the preview and, through the print-only copy, the PDF. */
function SummarySheet({ bundle, data }: { bundle: VentureBundle; data: Data }) {
  const { venture } = bundle
  const { dash, quotes } = data
  const ready = dash.readiness.filter((r) => r.done).length
  const top = [...dash.hypotheses].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]).slice(0, MAX_HYPOTHESES)
  const decision = dash.decisions[0]
  const h2 = 'mt-5 border-b border-border pb-1 text-base font-semibold text-primary'

  return (
    <div className="flex h-[11in] w-[8.5in] flex-col overflow-hidden bg-card p-[0.5in] text-[13px] text-foreground">
      <div className="flex items-start justify-between">
        <Wordmark className="text-primary" />
        <p className="text-right text-muted-foreground">
          Venture summary
          <br />
          <span className="tabular">{formatDate(today())}</span>
        </p>
      </div>
      <h1 className="mt-6 font-heading text-[32px] leading-tight font-semibold">{venture.name}</h1>
      <p className="text-muted-foreground">
        Stage {venture.stage}
        {venture.semester && ` · ${venture.semester}`}
      </p>
      {venture.pitch && <p className="mt-2 line-clamp-3 text-[15px]">{venture.pitch}</p>}

      <h2 className={h2}>
        Readiness: <span className="tabular">{ready}</span> of <span className="tabular">{dash.readiness.length}</span> ready
      </h2>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
        {dash.readiness.map((r) => (
          <li key={r.key} className="flex items-start gap-2">
            {r.done ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            )}
            <span>
              <span className="font-semibold">{r.done ? 'Done' : 'Not yet'}:</span> {r.label}{' '}
              <span className="tabular text-muted-foreground">({r.progress})</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className={h2}>Riskiest hypotheses</h2>
      {top.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {top.map((h) => (
            <li key={h.id} className="flex items-start gap-3">
              <span className="w-28 shrink-0">
                <StatusChip status={h.status} />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2">{h.statement}</span>
                <span className="tabular text-muted-foreground">
                  {RISK_LABELS[h.risk]} · {tallyText(h.tally)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">No hypotheses yet.</p>
      )}

      <h2 className={h2}>What customers said</h2>
      {quotes.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {quotes.map((q) => (
            <li key={q.id}>
              <blockquote className="line-clamp-3 border-l-2 border-primary pl-3 text-[15px] italic">“{q.text}”</blockquote>
              <p className="pl-3 text-muted-foreground">
                {[q.contact_name, q.date && formatDate(q.date)].filter(Boolean).join(', ') || 'No interview linked'}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">No quotes yet. Mark an insight as a quote to show it here.</p>
      )}

      <h2 className={h2}>Latest decision</h2>
      {decision ? (
        <div className="mt-2">
          <p className="font-semibold">
            {DECISION_LABELS[decision.decision]} · <span className="tabular">{formatDate(decision.decided_at.slice(0, 10))}</span>
          </p>
          {decision.rationale && <p className="line-clamp-4">{decision.rationale}</p>}
        </div>
      ) : (
        <p className="mt-2">No decision recorded yet.</p>
      )}

      <p className="mt-auto pt-4 text-muted-foreground">Made with Catalyst Discovery CRM</p>
    </div>
  )
}

export function SummaryDialog({
  bundle,
  onClose,
  onNotify,
  onError
}: {
  bundle: VentureBundle
  onClose: () => void
  onNotify: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([window.api.getDashboard(), window.api.listInsights()]).then(
      ([dash, insights]) => setData({ dash, quotes: insights.filter((n) => n.is_quote).slice(0, MAX_QUOTES) }),
      onError
    )
  }, [onError])

  const save = async () => {
    setBusy(true)
    try {
      const r = await window.api.saveSummaryPdf()
      if ('path' in r) {
        onNotify(`Summary saved to ${r.path}`)
        onClose()
      }
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent title="Summary PDF" description="One page for mentor meetings or demo day. Newest quotes, riskiest hypotheses first.">
        {/* Above the preview: at 700px tall the scaled page fills the dialog. */}
        <div className="mb-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!data || busy}>
            <FileDown aria-hidden strokeWidth={1.5} />
            {busy ? 'Saving…' : 'Save as PDF'}
          </Button>
        </div>
        {data && (
          <>
            {/* The preview is the real page, scaled to fit the dialog. */}
            <div className="overflow-hidden rounded-md border border-border [zoom:0.58]">
              <SummarySheet bundle={bundle} data={data} />
            </div>
            {createPortal(
              <div className="print-sheet hidden print:block">
                <SummarySheet bundle={bundle} data={data} />
              </div>,
              document.body
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
