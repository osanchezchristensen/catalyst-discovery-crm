import { FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/api'
import { formatDateTime } from '@/lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

export function AboutDialog({
  open,
  onOpenChange,
  onError
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onError: (err: unknown) => void
}) {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    if (open) window.api.getAppInfo().then(setInfo, onError)
  }, [open, onError])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="About Catalyst Discovery CRM" description="Talk to customers. Test the idea. Know what’s real.">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
          <dt className="font-semibold">Version</dt>
          <dd className="tabular">{info?.version ?? '…'}</dd>
          <dt className="font-semibold">Data folder</dt>
          <dd className="break-all select-text">{info?.dataDir ?? '…'}</dd>
          <dt className="font-semibold">Last backup</dt>
          <dd>{info ? formatDateTime(info.lastBackupAt) : '…'}</dd>
        </dl>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Your data stays on this computer. Nothing is sent over the network.
        </p>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={() => window.api.openDataFolder().catch(onError)}>
            <FolderOpen aria-hidden strokeWidth={1.5} />
            Open data folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
