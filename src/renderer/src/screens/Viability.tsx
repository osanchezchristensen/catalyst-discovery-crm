import { Circle, CircleCheck, Gavel, Pause, Shuffle, Square, Trash2, TrendingUp, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Dashboard, DecisionKind } from '../../../shared/schema'
import { BarChartCard } from '@/components/BarChartCard'
import { DecisionDialog } from '@/components/DecisionDialog'
import { StatusChip } from '@/components/StatusChip'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { DECISION_LABELS, STATUS_LABELS, TYPE_LABELS, formatDate, tallyText } from '@/lib/discovery'

// Axis labels must fit side by side, so weeks use month and day only.
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d))
}

/** The tag whose interviews hurt most, e.g. 'cost (4.5)'. */
const topPain = (tags: Dashboard['topTags']) => {
  const rated = tags.filter((t) => t.avgPain !== null).sort((a, b) => b.avgPain! - a.avgPain!)
  return rated.length ? `${rated[0].tag} (${rated[0].avgPain})` : 'no pain scores yet'
}

const DECISION_ICONS: Record<DecisionKind, LucideIcon> = { persevere: TrendingUp, pivot: Shuffle, pause: Pause, stop: Square }

export function Viability({ onNotify, onError }: { onNotify: (message: string) => void; onError: (err: unknown) => void }) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [deciding, setDeciding] = useState(false)
  const reload = useCallback(() => window.api.getDashboard().then(setData, onError), [onError])
  useEffect(() => void reload(), [reload])

  if (!data) return null
  const ready = data.readiness.filter((r) => r.done).length
  const total = data.perWeek.reduce((n, w) => n + w.count, 0)

  const removeDecision = async (id: string) => {
    if (!window.confirm("Delete this decision? A pivot's copied hypotheses stay. This can't be undone.")) return
    try {
      await window.api.deleteDecision(id)
      onNotify('Decision deleted')
      void reload()
    } catch (err) {
      onError(err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle>Readiness checklist</CardTitle>
        <p className="tabular mt-1 font-semibold">
          {ready} of {data.readiness.length} ready
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {data.readiness.map((r) => (
            <li key={r.key} className="flex items-start gap-3">
              {r.done ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              )}
              <div>
                <p>
                  <span className="font-semibold">{r.done ? 'Done' : 'Not yet'}:</span> {r.label}
                </p>
                <p className="tabular text-[13px] text-muted-foreground">{r.progress}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <BarChartCard
          title="Interviews per week"
          summary={`${total} ${total === 1 ? 'interview' : 'interviews'} in the weeks shown (up to 26). Weeks start on Monday.`}
          rows={data.perWeek.map((w) => ({ week: shortDate(w.week), count: w.count }))}
          category="week"
          categoryLabel="Week of"
          series={[{ key: 'count', label: 'Interviews', colorClass: 'text-chart-1' }]}
          empty="No interviews yet. Log your first to see your pace."
        />
        <BarChartCard
          title="Interviews by segment"
          summary="Segments come from each interview's contact."
          rows={data.bySegment}
          category="segment"
          categoryLabel="Segment"
          series={[{ key: 'count', label: 'Interviews', colorClass: 'text-chart-1' }]}
          horizontal
          empty="No interviews yet."
        />
        <BarChartCard
          title="Pain scores"
          summary={
            data.hasBeachhead
              ? 'How many interviews gave each pain score, overall and in your beachhead segment.'
              : 'How many interviews gave each pain score. Choose a beachhead segment to compare.'
          }
          rows={data.pain.some((p) => p.all) ? data.pain.map((p) => ({ score: String(p.score), all: p.all, beachhead: p.beachhead })) : []}
          category="score"
          categoryLabel="Pain score"
          series={
            data.hasBeachhead
              ? [
                  { key: 'all', label: 'All interviews', colorClass: 'text-chart-1' },
                  { key: 'beachhead', label: 'Beachhead', colorClass: 'text-chart-3' }
                ]
              : [{ key: 'all', label: 'All interviews', colorClass: 'text-chart-1' }]
          }
          empty="No pain scores yet. Rate pain 1–5 when you log an interview."
        />
        <BarChartCard
          title="Top insight tags"
          summary={
            data.topTags.length
              ? `Most-used tags. Highest average pain: ${topPain(data.topTags)}.`
              : 'Tag your insights to see which pains come up most.'
          }
          rows={data.topTags.map((t) => ({ tag: t.tag, count: t.count, avgPain: t.avgPain ?? 'Not rated' }))}
          category="tag"
          categoryLabel="Tag"
          series={[{ key: 'count', label: 'Insights', colorClass: 'text-chart-1' }]}
          tableExtras={[{ key: 'avgPain', label: 'Average pain (1–5)' }]}
          horizontal
          empty="No tagged insights yet."
        />
      </div>

      <Card className="overflow-x-auto">
        <CardTitle>Hypothesis scorecard</CardTitle>
        {data.hypotheses.length === 0 ? (
          <p className="mt-2">No hypotheses yet. Add them on the Hypotheses screen.</p>
        ) : (
          <table className="mt-4 w-full text-left">
            <caption className="sr-only">Current hypotheses with their evidence</caption>
            <thead className="bg-secondary text-[13px]">
              <tr>
                <th scope="col" className="px-3 py-2">Hypothesis</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2 text-right">Support</th>
                <th scope="col" className="px-3 py-2 text-right">Refute</th>
                <th scope="col" className="px-3 py-2 text-right">Neutral</th>
                <th scope="col" className="px-3 py-2">Evidence suggests</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.hypotheses.map((h) => (
                <tr key={h.id} className="border-b border-border">
                  <th scope="row" className="max-w-80 px-3 py-2 font-normal break-words">
                    <span className="block text-[13px] text-muted-foreground">{TYPE_LABELS[h.type]}</span>
                    {h.statement}
                  </th>
                  <td className="px-3 py-2">
                    <StatusChip status={h.status} />
                  </td>
                  <td className="px-3 py-2 text-right">{h.tally.supports}</td>
                  <td className="px-3 py-2 text-right">{h.tally.refutes}</td>
                  <td className="px-3 py-2 text-right">{h.tally.neutral}</td>
                  <td className="px-3 py-2">{h.suggested === h.status ? 'Same' : STATUS_LABELS[h.suggested]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Decision log</CardTitle>
          <Button onClick={() => setDeciding(true)}>
            <Gavel aria-hidden strokeWidth={1.5} />
            Record decision
          </Button>
        </div>
        {data.decisions.length === 0 ? (
          <p className="mt-2">No decisions yet. When the checklist is mostly done, decide: persevere, pivot, pause or stop.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            {data.decisions.map((d) => {
              const Icon = DECISION_ICONS[d.decision]
              return (
                <li key={d.id} className="border-l-2 border-primary pl-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-2">
                      <Icon className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
                      <span className="font-semibold">{DECISION_LABELS[d.decision]}</span>
                      <span className="tabular text-[13px] text-muted-foreground">{formatDate(d.decided_at.slice(0, 10))}</span>
                    </p>
                    <Button
                      variant="ghost-destructive"
                      size="icon"
                      aria-label={`Delete ${DECISION_LABELS[d.decision]} decision from ${formatDate(d.decided_at.slice(0, 10))}`}
                      onClick={() => removeDecision(d.id)}
                    >
                      <Trash2 aria-hidden strokeWidth={1.5} />
                    </Button>
                  </div>
                  <p className="mt-1 break-words whitespace-pre-line">{d.rationale}</p>
                  {d.decision === 'pivot' && (
                    <p className="mt-1 text-[13px] text-muted-foreground">Started a new version of the hypotheses.</p>
                  )}
                  {d.hypotheses.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1 text-[13px]">
                      {d.hypotheses.map((h) => (
                        <li key={h.hypothesis_id} className="flex flex-wrap items-center gap-2">
                          <StatusChip status={h.status} />
                          <span className="break-words">{h.statement}</span>
                          <span className="tabular text-muted-foreground">({tallyText(h.tally)})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      {deciding && (
        <DecisionDialog
          hypotheses={data.hypotheses}
          onClose={() => setDeciding(false)}
          onRecorded={(d) => {
            setDeciding(false)
            onNotify(`${DECISION_LABELS[d.decision]} recorded`)
            void reload()
          }}
          onError={onError}
        />
      )}
    </div>
  )
}
