import { useState } from 'react'
import type { ImportPreview } from '../../../shared/api'
import type { WorkspaceTable } from '../../../shared/schema'
import { formatDateTime } from '@/lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

// Same order as the workspace tables (parents first).
const LABELS: Record<WorkspaceTable, string> = {
  cohorts: 'Cohorts',
  ventures: 'Ventures',
  venture_members: 'Team members',
  segments: 'Segments',
  contacts: 'Contacts',
  interviews: 'Interviews',
  hypotheses: 'Hypotheses',
  evidence: 'Evidence links',
  insights: 'Insights',
  decisions: 'Decisions',
  tasks: 'Tasks'
}

export function ImportPreviewDialog({
  preview,
  unsaved,
  onClose,
  onApplied,
  onError
}: {
  preview: ImportPreview | null
  unsaved: boolean
  onClose: () => void
  onApplied: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [busy, setBusy] = useState(false)
  const rows = preview
    ? (Object.keys(LABELS) as WorkspaceTable[]).flatMap((t) => {
        const c = preview.counts[t]
        return c ? [{ table: t, ...c }] : []
      })
    : []

  const cancel = () => {
    if (preview) void window.api.cancelImport(preview.token)
    onClose()
  }
  const apply = async () => {
    if (!preview) return
    setBusy(true)
    try {
      await window.api.applyImport(preview.token)
      onApplied(`Imported ${preview.fileName}`)
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && !busy && cancel()}>
      {preview && (
        <DialogContent
          title="Review this import"
          description={`${preview.fileName}, exported by ${preview.exportedBy || 'unknown'} on ${formatDateTime(preview.exportedAt)}.`}
        >
          {rows.length === 0 ? (
            <p>This file has no records to import.</p>
          ) : (
            <table className="w-full text-left">
              <caption className="sr-only">Records to import, by type</caption>
              <thead className="bg-secondary text-[13px]">
                <tr>
                  <th scope="col" className="px-3 py-2">Record type</th>
                  <th scope="col" className="px-3 py-2 text-right">New</th>
                  <th scope="col" className="px-3 py-2 text-right">Updated</th>
                  <th scope="col" className="px-3 py-2 text-right">Unchanged</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.table} className="border-b border-border">
                    <th scope="row" className="px-3 py-2 font-normal">{LABELS[r.table]}</th>
                    <td className="px-3 py-2 text-right">{r.added}</td>
                    <td className="px-3 py-2 text-right">{r.updated}</td>
                    <td className="px-3 py-2 text-right">{r.unchanged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-[13px] text-muted-foreground">
            Your current data stays. A record is replaced only when the file has a newer copy. A backup is taken first.
          </p>
          {unsaved && (
            <p className="mt-2 font-semibold">Your unsaved venture changes will be discarded.</p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy || rows.length === 0}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
