// Date helpers shared by main and renderer. Dates are YYYY-MM-DD strings; week math runs in UTC
// so no time zone or daylight-saving change can shift a day.
const DAY_MS = 24 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date in this computer's time zone, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Monday of the week containing a YYYY-MM-DD date. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return addDays(date, -((d.getUTCDay() + 6) % 7))
}
