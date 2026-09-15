'use client'

import type { JiraBug } from '@/lib/jira'
import { statusClass } from '@/lib/jira'
import type { Squad } from './SquadColumn'

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'bg-red-50 text-red-700',
  highest: 'bg-red-50 text-red-700',
  high: 'bg-orange-50 text-orange-700',
  medium: 'bg-yellow-50 text-yellow-800',
  low: 'bg-slate-100 text-slate-500',
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function priorityRank(bug: JiraBug): number {
  return PRIORITY_ORDER[(bug.fields.priority?.name ?? 'Low').toLowerCase()] ?? PRIORITY_ORDER.low
}

function sortBugs(bugs: JiraBug[]): JiraBug[] {
  return [...bugs].sort((a, b) => priorityRank(a) - priorityRank(b))
}

function BugCard({ bug }: { bug: JiraBug }) {
  const priorityName = bug.fields.priority?.name ?? 'Low'
  const priorityClass = PRIORITY_LABELS[priorityName.toLowerCase()] ?? PRIORITY_LABELS.low
  const versions = bug.fields.fixVersions.map(v => v.name)

  return (
    <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <a
          href={bug.webUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-slate-800 leading-snug flex-1 hover:text-blue-600"
        >
          {bug.fields.summary}
        </a>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {versions.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-blue-50 text-blue-700">
              {versions.join(', ')}
            </span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${priorityClass}`}>
            {priorityName}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        {bug.fields.assignee?.displayName && (
          <span className="truncate">{bug.fields.assignee.displayName}</span>
        )}
        <span className="font-mono text-slate-300 ml-auto">{bug.key}</span>
      </div>
    </div>
  )
}

function BugSection({
  title,
  badgeClass,
  bugs,
}: {
  title: string
  badgeClass: string
  bugs: JiraBug[]
}) {
  if (bugs.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>{title}</span>
        <span className="text-[10px] text-slate-400">{bugs.length}</span>
      </div>
      {bugs.map(bug => (
        <BugCard key={bug.id} bug={bug} />
      ))}
    </div>
  )
}

export function BugColumn({ squad, bugs }: { squad: Squad; bugs: JiraBug[] }) {
  const inprog = sortBugs(bugs.filter(b => statusClass(b.fields.status.statusCategory.key) === 'inprog'))
  const todo = sortBugs(bugs.filter(b => statusClass(b.fields.status.statusCategory.key) === 'todo'))
  const pending = sortBugs(bugs.filter(b => statusClass(b.fields.status.statusCategory.key) === 'done'))

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b-4 flex items-center gap-2" style={{ borderBottomColor: squad.color }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: squad.color }} />
        <span className="text-sm font-bold text-slate-800">{squad.name}</span>
        <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {bugs.length}
        </span>
      </div>

      <div className="p-2 flex flex-col gap-3 flex-1">
        {bugs.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-6 leading-relaxed">
            <div className="text-2xl mb-2">🐛</div>
            <strong className="text-slate-500">No bugs to show</strong>
            <br />None open, or none match the current filters.
          </div>
        )}
        <BugSection title="IN PROGRESS" badgeClass="bg-amber-50 text-amber-800" bugs={inprog} />
        <BugSection title="TO DO" badgeClass="bg-slate-100 text-slate-500" bugs={todo} />
        <BugSection title="PENDING RELEASE" badgeClass="bg-green-50 text-green-700" bugs={pending} />
      </div>
    </div>
  )
}
