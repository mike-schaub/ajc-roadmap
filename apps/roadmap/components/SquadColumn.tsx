'use client'

import type { JiraEpic, JiraStory } from '@/lib/jira'
import { statusClass } from '@/lib/jira'
import { EpicCard } from './EpicCard'

export interface Squad {
  key: string
  name: string
  color: string
}

type Filter = 'all' | 'todo' | 'inprog' | 'done'

export function SquadColumn({
  squad,
  epics,
  storiesByEpic,
  commentSummaries,
  filter,
}: {
  squad: Squad
  epics: JiraEpic[]
  storiesByEpic: Record<string, JiraStory[]>
  commentSummaries: Record<string, string | null>
  filter: Filter
}) {
  const visible = filter === 'all'
    ? epics
    : epics.filter(e => statusClass(e.fields.status.statusCategory.key) === filter)

  const todo   = epics.filter(e => statusClass(e.fields.status.statusCategory.key) === 'todo').length
  const inprog = epics.filter(e => statusClass(e.fields.status.statusCategory.key) === 'inprog').length
  const done   = epics.filter(e => statusClass(e.fields.status.statusCategory.key) === 'done').length

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b-4 flex items-center gap-2" style={{ borderBottomColor: squad.color }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: squad.color }} />
        <span className="text-sm font-bold text-slate-800">{squad.name}</span>
        <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {visible.length}
        </span>
      </div>

      <div className="px-3 py-2 border-b border-slate-100 flex gap-1.5 flex-wrap">
        {todo   > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{todo} To Do</span>}
        {inprog > 0 && <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-semibold">{inprog} In Progress</span>}
        {done   > 0 && <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold">{done} Done</span>}
        {epics.length === 0 && <span className="text-[10px] text-slate-400">No epics yet</span>}
      </div>

      <div className="p-2 flex flex-col gap-1.5 flex-1">
        {visible.length === 0 && epics.length > 0 && (
          <p className="text-center text-xs text-slate-400 py-6">No epics match this filter.</p>
        )}
        {visible.length === 0 && epics.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-6 leading-relaxed">
            <div className="text-2xl mb-2">📋</div>
            <strong className="text-slate-500">No epics yet</strong>
            <br />Add epics to <strong>{squad.key}</strong> in Jira.
          </div>
        )}
        {visible.map(epic => (
          <EpicCard
            key={epic.id}
            epic={epic}
            stories={storiesByEpic[epic.key] ?? []}
            commentSummaries={commentSummaries}
          />
        ))}
      </div>
    </div>
  )
}
