import { CircleCheck, CircleDashed, Quote } from 'lucide-react'
import { useEffect, useState } from 'react'
import { compareByType, referralChains, type ReferralNode, type TypeSummary } from '../../../shared/patterns'
import type { Contact, Insight, Interview } from '../../../shared/schema'
import { BarChartCard } from '@/components/BarChartCard'
import { Card, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/discovery'

/** Below this many interviews of a type, a side-by-side reads as more certain than it is. */
const MIN_TO_COMPARE = 3

/** Pattern finders that cut across screens (backlog #11): referral chains and Validation vs Sales. */
export function Patterns({ onOpenInterview, onError }: { onOpenInterview: (id: string) => void; onError: (err: unknown) => void }) {
  const [data, setData] = useState<{ contacts: Contact[]; interviews: Interview[]; insights: Insight[] } | null>(null)
  useEffect(() => {
    Promise.all([window.api.listContacts(), window.api.listInterviews(), window.api.listInsights()]).then(
      ([contacts, interviews, insights]) => setData({ contacts, interviews, insights }),
      onError
    )
  }, [onError])
  if (!data) return null

  const chains = referralChains(data.contacts, data.interviews)
  // listInterviews is newest first, so the first one seen per contact is their latest.
  const latest = new Map<string, string>()
  for (const i of data.interviews) if (i.contact_id && !latest.has(i.contact_id)) latest.set(i.contact_id, i.id)
  const { validation, sales } = compareByType(data.interviews, data.insights)

  const person = (n: ReferralNode<Contact>) => {
    const interviewId = latest.get(n.contact.id)
    return (
      <li key={n.contact.id} className="mt-2">
        <span className="inline-flex items-center gap-2">
          {n.interviewed ? (
            <CircleCheck className="size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
          ) : (
            <CircleDashed className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          )}
          {interviewId ? (
            <button type="button" onClick={() => onOpenInterview(interviewId)} className="font-semibold text-primary underline-offset-2 hover:underline">
              {n.contact.name}
            </button>
          ) : (
            <span className="font-semibold">{n.contact.name}</span>
          )}
          {n.contact.organization && <span className="text-muted-foreground">, {n.contact.organization}</span>}
          <span className="text-[13px] text-muted-foreground">({n.interviewed ? 'interviewed' : 'not interviewed yet'})</span>
        </span>
        {n.children.length > 0 && <ul className="ml-6 border-l border-border pl-4">{n.children.map(person)}</ul>}
      </li>
    )
  }

  const column = (title: string, s: TypeSummary<Interview, Insight>) => (
    <section aria-labelledby={`compare-${title}`} className="flex flex-col gap-3">
      <h3 id={`compare-${title}`} className="font-semibold">
        {title}
      </h3>
      <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
        <dt className="text-muted-foreground">Interviews</dt>
        <dd>{s.count}</dd>
        <dt className="text-muted-foreground">Average pain</dt>
        <dd>{s.avgPain === null ? 'Not rated' : `${s.avgPain} of 5 (n = ${s.rated})`}</dd>
        <dt className="text-muted-foreground">Buying signals</dt>
        <dd>{`${s.signals.length} of ${s.count}`}</dd>
      </dl>
      {s.count < MIN_TO_COMPARE && (
        <p className="text-[13px] text-muted-foreground">
          {s.count === 0 ? `No ${title} interviews yet. Pick the type when you log an interview.` : 'Not enough interviews to compare yet.'}
        </p>
      )}
      {s.signals.length > 0 && (
        <ul className="flex flex-col gap-1 text-[15px]">
          {s.signals.slice(0, 5).map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onOpenInterview(i.id)} className="text-left text-primary underline-offset-2 hover:underline">
                {i.wtp_signal}
              </button>{' '}
              <span className="text-[13px] text-muted-foreground">
                ({i.contact_name ?? 'No contact'}, {formatDate(i.date)})
              </span>
            </li>
          ))}
        </ul>
      )}
      {s.quotes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {s.quotes.map((q) => (
            <li key={q.id} className="flex gap-2">
              <Quote className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              <button type="button" onClick={() => onOpenInterview(q.interview_id!)} className="text-left underline-offset-2 hover:underline">
                “{q.text}”{' '}
                <span className="text-[13px] text-muted-foreground">
                  {q.contact_name ?? 'No contact'}
                  {q.date ? `, ${formatDate(q.date)}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const painRows = validation.rated + sales.rated ? [1, 2, 3, 4, 5].map((n) => ({ score: String(n), validation: validation.pain[n - 1], sales: sales.pain[n - 1] })) : []

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle>Referral chains</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">Who led you to whom. Good interviews often end with “Who else should I talk to?”</p>
        {chains.length ? (
          <ul className="mt-2">{chains.map(person)}</ul>
        ) : (
          <p className="mt-3">
            No referrals yet. In an interview, add the people they suggest under “Who did they suggest?”, or set “Referred by” on a contact.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Validation vs Sales</CardTitle>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Do people who could buy feel the pain as much as the people you validate with? Informational interviews are left out.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-6">
          {column('Validation', validation)}
          {column('Sales', sales)}
        </div>
      </Card>

      <BarChartCard
        title="Pain scores by interview type"
        summary="How many Validation and Sales interviews gave each pain score."
        rows={painRows}
        category="score"
        categoryLabel="Pain score"
        series={[
          { key: 'validation', label: 'Validation', colorClass: 'text-chart-1' },
          { key: 'sales', label: 'Sales', colorClass: 'text-chart-3' }
        ]}
        empty="No pain scores on Validation or Sales interviews yet."
      />
    </div>
  )
}
