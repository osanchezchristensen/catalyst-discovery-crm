import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Interview } from '../../../shared/schema'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FORMAT_LABELS, formatDate } from '@/lib/discovery'

export function Interviews({ onOpen, onError }: { onOpen: (id: string | null) => void; onError: (err: unknown) => void }) {
  const [interviews, setInterviews] = useState<Interview[] | null>(null)
  useEffect(() => {
    window.api.listInterviews().then(setInterviews, onError)
  }, [onError])

  if (!interviews) return null
  const logButton = (
    <Button onClick={() => onOpen(null)}>
      <Plus aria-hidden strokeWidth={1.5} />
      Log interview
    </Button>
  )

  if (interviews.length === 0) {
    return (
      <Card>
        <p>No interviews yet. Most viable ventures start with 10. Log your first.</p>
        <div className="mt-4">{logButton}</div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="tabular">
          {interviews.length} {interviews.length === 1 ? 'interview' : 'interviews'} logged
        </p>
        {logButton}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left">
          <caption className="sr-only">Interviews, newest first</caption>
          <thead className="bg-secondary text-[13px]">
            <tr>
              <th scope="col" className="px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Contact</th>
              <th scope="col" className="px-3 py-2">Format</th>
              <th scope="col" className="px-3 py-2 text-right">Pain (1–5)</th>
              <th scope="col" className="px-3 py-2">Next step</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((i) => (
              <tr key={i.id} className="border-b border-border">
                <th scope="row" className="px-3 py-2 font-normal whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onOpen(i.id)}
                    className="tabular font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {formatDate(i.date)}
                  </button>
                </th>
                <td className="max-w-56 truncate px-3 py-2">{i.contact_name ?? 'No contact'}</td>
                <td className="px-3 py-2">{FORMAT_LABELS[i.format]}</td>
                <td className="tabular px-3 py-2 text-right">{i.pain_score ?? 'Not rated'}</td>
                <td className="max-w-72 truncate px-3 py-2">{i.next_step}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
