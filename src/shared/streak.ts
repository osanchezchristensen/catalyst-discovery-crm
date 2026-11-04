import { addDays } from './dates'

/**
 * Consecutive weeks (Monday-start) that met the interview goal, counting back from this week.
 * This week extends the streak only once it is met, so the streak never "breaks" mid-week.
 * shortcut: past weeks are judged against today's goal (no goal history); store one if goals change often.
 */
export function streak(perWeek: Map<string, number>, goal: number, thisWeek: string): number {
  const met = (week: string) => (perWeek.get(week) ?? 0) >= goal
  let n = met(thisWeek) ? 1 : 0
  for (let w = addDays(thisWeek, -7); met(w); w = addDays(w, -7)) n++
  return n
}
