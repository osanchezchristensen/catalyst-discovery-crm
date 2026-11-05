import { chmodSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * On macOS and Linux the default umask leaves new folders readable by other users of the computer.
 * Locking the data folder to its owner also covers the database, backups and attachments inside it.
 * Call it before anything is written there. Windows already keeps each user's AppData private.
 */
export function restrictDataFolder(dataDir: string, platform: NodeJS.Platform = process.platform): void {
  if (platform === 'win32') return
  try {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    chmodSync(dataDir, 0o700)
  } catch (err) {
    console.error('Could not restrict the data folder permissions', err)
  }
}

/** The most recently written backup file, if any. Never throws: it runs inside the open-failure handler. */
export function newestBackup(backupsDir: string): string | null {
  if (!existsSync(backupsDir)) return null
  try {
    const files = readdirSync(backupsDir)
      .filter((f) => f.endsWith('.sqlite'))
      .map((f) => ({ f, t: statSync(join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    return files[0] ? join(backupsDir, files[0].f) : null
  } catch {
    return null
  }
}

/** What to tell a student when their data won't open, including where to find a backup to restore. */
export function openFailureDetail(err: unknown, dataDir: string, backupsDir: string): string {
  const reason = err instanceof Error ? err.message : String(err)
  const backup = newestBackup(backupsDir)
  return [
    reason,
    '',
    `Your data folder: ${dataDir}`,
    backup
      ? `Newest backup: ${backup}\nTo restore it, quit the app, move catalyst.sqlite and any catalyst.sqlite-wal and catalyst.sqlite-shm files out of the data folder to somewhere safe, then copy the backup in and rename it to catalyst.sqlite.`
      : 'No backups were found.',
    'If this keeps happening, ask your program staff for help and bring this message.'
  ].join('\n')
}
