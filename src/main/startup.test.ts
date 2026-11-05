import { existsSync, mkdirSync, mkdtempSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { newestBackup, openFailureDetail, restrictDataFolder } from './startup'

const tmp = () => mkdtempSync(join(tmpdir(), 'crm-startup-'))

describe('startup helpers', () => {
  it.skipIf(process.platform === 'win32')('locks the data folder to its owner on macOS and Linux', () => {
    const dir = tmp()
    restrictDataFolder(dir)
    expect(statSync(dir).mode & 0o777).toBe(0o700)
  })

  it.skipIf(process.platform === 'win32')('creates a missing data folder already locked', () => {
    const dir = join(tmp(), 'new', 'data')
    restrictDataFolder(dir)
    expect(statSync(dir).mode & 0o777).toBe(0o700)
  })

  it('leaves Windows alone', () => {
    const dir = join(tmp(), 'missing')
    restrictDataFolder(dir, 'win32')
    expect(existsSync(dir)).toBe(false)
  })

  it('points to the newest backup when the data will not open', () => {
    const data = tmp()
    const backups = join(data, 'backups')
    mkdirSync(backups)
    writeFileSync(join(backups, 'pre-migration-v3-to-v4-x.sqlite'), '')
    writeFileSync(join(backups, 'catalyst-2026-01-01.sqlite'), '')
    utimesSync(join(backups, 'catalyst-2026-01-01.sqlite'), new Date(2020, 0, 1), new Date(2020, 0, 1))
    expect(newestBackup(backups)).toBe(join(backups, 'pre-migration-v3-to-v4-x.sqlite'))
    const text = openFailureDetail(new Error('database disk image is malformed'), data, backups)
    expect(text).toContain('database disk image is malformed')
    expect(text).toContain(join(backups, 'pre-migration-v3-to-v4-x.sqlite'))
    expect(text).toContain('catalyst.sqlite-wal') // a stale WAL file would corrupt the restored backup
    expect(openFailureDetail('x', data, join(data, 'none'))).toContain('No backups were found.')
    // An unreadable backups path must not break the error dialog itself.
    expect(openFailureDetail('x', data, join(backups, 'catalyst-2026-01-01.sqlite'))).toContain('No backups were found.')
  })
})
