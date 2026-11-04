import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { Card, CardTitle } from './ui/card'

// Dataviz rules: bars <= 24px, 4px rounded data end, 2px gap between grouped bars, recessive grid,
// text in text tokens, a legend only for 2+ series, and a table view (visually hidden here).
// Colors come from brand tokens via currentColor, because SVG attributes can't read CSS variables.
export type Series = { key: string; label: string; colorClass: string }

const tick = { fill: 'currentColor', fontSize: 13 }
// Category labels must fit the 120px axis; the tooltip and the table keep the full name.
const shorten = (v: string | number) => (String(v).length > 16 ? `${String(v).slice(0, 15)}…` : String(v))
const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--foreground))',
  fontSize: 13
}

export function BarChartCard({
  title,
  summary,
  rows,
  category,
  categoryLabel,
  series,
  horizontal = false,
  empty
}: {
  title: string
  summary: string
  rows: Record<string, string | number>[]
  category: string
  categoryLabel: string
  series: Series[]
  horizontal?: boolean
  empty: string
}) {
  const height = horizontal ? Math.max(160, rows.length * 36 + 40) : 220
  return (
    <Card>
      <figure>
        <figcaption>
          <CardTitle>{title}</CardTitle>
        </figcaption>
        <p className="mt-1 text-[13px] text-muted-foreground">{summary}</p>
        {series.length > 1 && rows.length > 0 && (
          // Our own legend: Recharts' would draw every swatch in currentColor, losing the series colors.
          <ul className="mt-2 flex flex-wrap gap-4 text-[13px]" aria-hidden>
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className={cn('size-3 rounded-sm bg-current', s.colorClass)} />
                {s.label}
              </li>
            ))}
          </ul>
        )}
        {rows.length === 0 ? (
          <p className="mt-4">{empty}</p>
        ) : (
          <>
            <div className="mt-4 text-muted-foreground" style={{ height }} aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} barGap={2} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.15} horizontal={!horizontal} vertical={horizontal} />
                  {horizontal ? (
                    <>
                      <XAxis type="number" allowDecimals={false} tick={tick} stroke="currentColor" strokeOpacity={0.3} />
                      <YAxis type="category" dataKey={category} width={120} tick={tick} tickFormatter={shorten} stroke="currentColor" strokeOpacity={0.3} />
                    </>
                  ) : (
                    <>
                      <XAxis dataKey={category} tick={tick} stroke="currentColor" strokeOpacity={0.3} />
                      <YAxis allowDecimals={false} width={32} tick={tick} stroke="currentColor" strokeOpacity={0.3} />
                    </>
                  )}
                  <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} contentStyle={tooltipStyle} />
                  {series.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      className={s.colorClass}
                      fill="currentColor"
                      maxBarSize={24}
                      radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                      isAnimationActive={false}
                    >
                      {series.length === 1 && (
                        <LabelList dataKey={s.key} position={horizontal ? 'right' : 'top'} className="fill-foreground text-[13px]" />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th scope="col">{categoryLabel}</th>
                  {series.map((s) => (
                    <th key={s.key} scope="col">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r[category])}>
                    <th scope="row">{r[category]}</th>
                    {series.map((s) => (
                      <td key={s.key}>{r[s.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </figure>
    </Card>
  )
}
