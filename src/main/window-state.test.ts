import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadWindowState, saveWindowState } from './window-state'

const screen = [{ x: 0, y: 0, width: 1920, height: 1080 }]
const file = () => join(mkdtempSync(join(tmpdir(), 'crm-win-')), 'window-state.json')

describe('window state', () => {
  it('restores saved bounds on a visible display', () => {
    const f = file()
    saveWindowState(f, { x: 100, y: 50, width: 1200, height: 750 }, true)
    expect(loadWindowState(f, screen)).toEqual({ x: 100, y: 50, width: 1200, height: 750, maximized: true })
  })

  it('drops the position when the display is gone', () => {
    const f = file()
    saveWindowState(f, { x: 3000, y: 50, width: 1200, height: 750 }, false)
    expect(loadWindowState(f, screen)).toEqual({ width: 1200, height: 750, maximized: false })
  })

  it('falls back to defaults for missing, broken or too-small state', () => {
    expect(loadWindowState(file(), screen).width).toBe(1280)
    const f = file()
    writeFileSync(f, '{oops')
    expect(loadWindowState(f, screen).width).toBe(1280)
    saveWindowState(f, { x: 0, y: 0, width: 500, height: 400 }, false)
    expect(loadWindowState(f, screen).width).toBe(1280)
  })
})
