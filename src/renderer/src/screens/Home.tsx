import { DatabaseBackup, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Interview } from '../../../shared/schema'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FORMAT_LABELS, formatDate } from '@/lib/discovery'
import { formatDateTime } from '@/lib/utils'

const RECENT = 5

export function Home({
  lastBackupAt,
  onBackup,
  onOpenInterview,
  onError
}: {
  lastBackupAt: string | null
  onBackup: () => void
  onOpenInterview: (id: string | null) => void
  onError: (err: unknown) => void
}) {
  const [recent, setRecent] = useState<Interview[] | null>(null)
  useEffect(() => {
    window.api.listInterviews().then((all) => setRecent(all.slice(0, RECENT)), onError)
  }, [onError])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Recent interviews</CardTitle>
        {recent && recent.length === 0 && (
          <p className="mt-2">No interviews yet. Most viable ventures start with 10. Log your first.</p>
        )}
        {recent && recent.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {recent.map((i) => (
              <li key={i.id} className="flex min-w-0 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenInterview(i.id)}
                  className="tabular shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {formatDate(i.date)}
                </button>
                <span className="truncate">
                  {i.contact_name ?? 'No contact'}, {FORMAT_LABELS[i.format]}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button className="mt-4" onClick={() => onOpenInterview(null)}>
          <Plus aria-hidden strokeWidth={1.5} />
          Log interview
        </Button>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Shortcut: <kbd className="font-semibold">Ctrl</kbd>+<kbd className="font-semibold">N</kbd> (
          <kbd className="font-semibold">Cmd</kbd>+<kbd className="font-semibold">N</kbd> on a Mac)
        </p>
      </Card>
      <Card>
        <CardTitle>Backups</CardTitle>
        <p className="mt-2">
          Last backup: <span className="tabular font-semibold">{formatDateTime(lastBackupAt)}</span>
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The app backs up when it opens and once a day, and keeps one backup a day for the last 14 days.
        </p>
        <Button variant="secondary" className="mt-4" onClick={onBackup}>
          <DatabaseBackup aria-hidden strokeWidth={1.5} />
          Back up now
        </Button>
      </Card>
    </div>
  )
}
