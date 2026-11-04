import { AlertCircle, DatabaseBackup, Flame, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { weeklyGoalInput, type Home as HomeData, type Interview, type Task } from '../../../shared/schema'
import { TextField } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FORMAT_LABELS, formatDate, today } from '@/lib/discovery'
import { formatDateTime } from '@/lib/utils'

const RECENT = 5

export function Home({
  lastBackupAt,
  onBackup,
  onOpenInterview,
  onNotify,
  onError
}: {
  lastBackupAt: string | null
  onBackup: () => void
  onOpenInterview: (id: string | null) => void
  onNotify: (message: string) => void
  onError: (err: unknown) => void
}) {
  const [home, setHome] = useState<HomeData | null>(null)
  const [recent, setRecent] = useState<Interview[] | null>(null)
  const [goalText, setGoalText] = useState('')
  const [goalError, setGoalError] = useState<string>()
  const [task, setTask] = useState({ title: '', due: '' })
  const [taskError, setTaskError] = useState<string>()

  const reload = useCallback(() => {
    window.api.listInterviews().then((all) => setRecent(all.slice(0, RECENT)), onError)
    return window.api.getHome().then((h) => {
      setHome(h)
      setGoalText(String(h.goal))
    }, onError)
  }, [onError])
  useEffect(() => void reload(), [reload])

  if (!home) return null

  const saveGoal = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = weeklyGoalInput.safeParse(Number(goalText))
    if (!parsed.success) return setGoalError(parsed.error.issues[0].message)
    const goal = parsed.data
    try {
      await window.api.setWeeklyGoal(goal)
      setGoalError(undefined)
      onNotify(`Weekly goal set to ${goal}`)
      void reload()
    } catch (err) {
      onError(err)
    }
  }

  const addTask = async (e: FormEvent) => {
    e.preventDefault()
    if (!task.title.trim()) return setTaskError('Describe the follow-up')
    try {
      await window.api.saveTask({ title: task.title.trim(), due_date: task.due || null, interview_id: null, done: false })
      setTask({ title: '', due: '' })
      setTaskError(undefined)
      void reload()
    } catch (err) {
      onError(err)
    }
  }

  // Ticked follow-ups stay listed (struck through) until the next visit, so a mis-click can be undone.
  const toggle = async (t: Task) => {
    try {
      await window.api.saveTask({ ...t, done: !t.done })
      setHome({ ...home, tasks: home.tasks.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)) })
      if (!t.done) onNotify(`Checked off "${t.title}"`)
    } catch (err) {
      onError(err)
    }
  }

  const now = today()
  const met = home.thisWeek >= home.goal

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>This week</CardTitle>
        <p className="tabular mt-2 text-2xl font-semibold">
          {home.thisWeek} of {home.goal} interviews
        </p>
        <p className="mt-1">{met ? 'Goal met. Keep the momentum.' : `${home.goal - home.thisWeek} to go this week.`}</p>
        <p className="mt-2 flex items-center gap-2 font-semibold">
          <Flame className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
          {home.streak ? `${home.streak}-week streak` : 'No streak yet'}
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <Button onClick={() => onOpenInterview(null)}>
            <Plus aria-hidden strokeWidth={1.5} />
            Log interview
          </Button>
          <form onSubmit={saveGoal} noValidate className="flex items-start gap-2">
            <div className="w-24">
              <TextField
                label="Weekly goal"
                hideLabel
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                error={goalError}
              />
            </div>
            <Button type="submit" variant="secondary">
              Set weekly goal
            </Button>
          </form>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Shortcut: <kbd className="font-semibold">Ctrl</kbd>+<kbd className="font-semibold">N</kbd> (
          <kbd className="font-semibold">Cmd</kbd>+<kbd className="font-semibold">N</kbd> on a Mac)
        </p>
      </Card>

      <Card>
        <CardTitle>Next follow-ups</CardTitle>
        {home.tasks.length === 0 ? (
          <p className="mt-2">No follow-ups. Turn an interview&apos;s next step into one, or add it here.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {home.tasks.slice(0, 8).map((t) => {
              const overdue = !t.done && !!t.due_date && t.due_date < now
              return (
                <li key={t.id} className="flex items-start gap-2">
                  <input
                    id={`task-${t.id}`}
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-primary"
                    checked={t.done}
                    onChange={() => toggle(t)}
                  />
                  <label htmlFor={`task-${t.id}`} className={t.done ? 'min-w-0 break-words text-muted-foreground line-through' : 'min-w-0 break-words'}>
                    {t.title}
                  </label>
                  {t.due_date && (
                    <span className="ml-auto flex shrink-0 items-center gap-1 text-[13px] whitespace-nowrap">
                      {overdue && <AlertCircle className="size-4" strokeWidth={1.5} aria-hidden />}
                      <span className={overdue ? 'font-semibold' : 'text-muted-foreground'}>
                        {overdue ? 'Overdue, ' : 'Due '}
                        {formatDate(t.due_date)}
                      </span>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <form onSubmit={addTask} noValidate className="mt-4 flex items-start gap-2">
          <div className="flex-1">
            <TextField
              label="New follow-up"
              hideLabel
              placeholder="Add a follow-up…"
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              error={taskError}
              maxLength={200}
            />
          </div>
          <div className="w-40">
            <TextField label="Due date" hideLabel type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} />
          </div>
          <Button type="submit" variant="secondary">
            <Plus aria-hidden strokeWidth={1.5} />
            Add
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Recent interviews</CardTitle>
        {recent && recent.length === 0 && (
          <p className="mt-2">No interviews yet. Most viable ventures start with 10. Log your first.</p>
        )}
        {recent && recent.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {recent.map((i) => (
              <li key={i.id} className="flex min-w-0 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenInterview(i.id)}
                  className="tabular shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {formatDate(i.date)}
                </button>
                <span className="truncate">
                  {i.contact_name ?? 'No contact'}, {FORMAT_LABELS[i.format]}
                </span>
              </li>
            ))}
          </ul>
        )}
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
