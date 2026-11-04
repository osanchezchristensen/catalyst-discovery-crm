import { DatabaseBackup } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'

export function Home({
  lastBackupAt,
  onBackup,
  onSetUpVenture
}: {
  lastBackupAt: string | null
  onBackup: () => void
  onSetUpVenture: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Interviews</CardTitle>
        <p className="mt-2">No interviews yet. Most viable ventures start with 10. Get your venture ready first.</p>
        <Button className="mt-4" onClick={onSetUpVenture}>
          Set up your venture
        </Button>
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
