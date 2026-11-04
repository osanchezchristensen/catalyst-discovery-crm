import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'

export const MIN_WIDTH = 1024
export const MIN_HEIGHT = 700
type Rect = { x: number; y: number; width: number; height: number }
export type WindowState = { width: number; height: number; x?: number; y?: number; maximized: boolean }

const DEFAULTS: WindowState = { width: 1280, height: 800, maximized: false }
const saved = z.object({
  x: z.int(),
  y: z.int(),
  width: z.int().min(MIN_WIDTH).max(20_000),
  height: z.int().min(MIN_HEIGHT).max(20_000),
  maximized: z.boolean()
})

/** Saved bounds, or defaults when the file is missing or broken. Position is dropped unless the window's center is on a connected display. */
export function loadWindowState(file: string, workAreas: Rect[]): WindowState {
  let parsed: z.infer<typeof saved>
  try {
    parsed = saved.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return DEFAULTS
  }
  const cx = parsed.x + parsed.width / 2
  const cy = parsed.y + parsed.height / 2
  const visible = workAreas.some((a) => cx >= a.x && cx < a.x + a.width && cy >= a.y && cy < a.y + a.height)
  return visible ? parsed : { width: parsed.width, height: parsed.height, maximized: parsed.maximized }
}

export function saveWindowState(file: string, bounds: Rect, maximized: boolean): void {
  try {
    writeFileSync(file, JSON.stringify({ ...bounds, maximized }))
  } catch {
    // Losing the window position is harmless; never block quitting over it.
  }
}
