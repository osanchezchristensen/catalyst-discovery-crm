import { House, Lightbulb, MessagesSquare, Rocket, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Wordmark } from './Wordmark'

export type Screen = 'home' | 'venture' | 'contacts' | 'hypotheses' | 'interviews'
type NavItem = { id: Screen; label: string; icon: LucideIcon }

const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'venture', label: 'Venture', icon: Rocket },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'hypotheses', label: 'Hypotheses', icon: Lightbulb },
  { id: 'interviews', label: 'Interviews', icon: MessagesSquare }
]

export function Sidebar({
  screen,
  onNavigate,
  ventureName
}: {
  screen: Screen
  onNavigate: (s: Screen) => void
  ventureName: string
}) {
  return (
    <aside className="on-dark flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <Wordmark className="px-5 pt-6 pb-8" />
      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={screen === id ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left font-medium transition-colors duration-150 ease-out',
                  screen === id ? 'bg-primary' : 'hover:bg-sidebar-foreground/10'
                )}
              >
                <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="truncate px-5 py-4 text-[13px]" title={ventureName}>
        {ventureName}
      </p>
    </aside>
  )
}
