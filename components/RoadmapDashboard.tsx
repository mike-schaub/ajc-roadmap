'use client'

import { useState } from 'react'
import type { JiraEpic, JiraStory, JiraBug } from '@/lib/jira'
import { statusClass } from '@/lib/jira'
import { SquadColumn } from './SquadColumn'
import type { Squad } from './SquadColumn'
import { BugColumn } from './BugColumn'
import { GanttView } from './GanttView'
import { FilterDropdown } from './FilterDropdown'

const SQUADS: Squad[] = [
  { key: 'CORE', name: 'Core Products',     color: '#3b82f6' },
  { key: 'MA',   name: 'Mobile App',        color: '#004FFF' },
  { key: 'EPS',  name: 'Emerging Products', color: '#1AA368' },
  { key: 'MPS',  name: 'Monetization',      color: '#f59e0b' },
]

const BUG_STATUS_OPTIONS = [
  { key: 'todo', label: 'To Do' },
  { key: 'inprog', label: 'In Progress' },
  { key: 'pending', label: 'Pending Release' },
]

type Filter = 'all' | 'todo' | 'inprog' | 'done'
type Tab = 'board' | 'gantt' | 'bugs'

export function RoadmapDashboard({
  grouped,
  storiesByEpic,
  commentSummaries,
  bugsGrouped,
  fetchedAt,
  today,
  error,
}: {
  grouped: Record<string, JiraEpic[]>
  storiesByEpic: Record<string, JiraStory[]>
  commentSummaries: Record<string, string | null>
  bugsGrouped: Record<string, JiraBug[]>
  fetchedAt: string | null
  today: string
  error: string | null
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>('gantt')

  const [bugStatusFilter, setBugStatusFilter] = useState<Set<string>>(
    () => new Set(BUG_STATUS_OPTIONS.map(o => o.key))
  )
  const [bugProjectFilter, setBugProjectFilter] = useState<Set<string>>(
    () => new Set(SQUADS.map(s => s.key))
  )
  const [bugReleaseFilter, setBugReleaseFilter] = useState('all')
  const [bugSearch, setBugSearch] = useState('')

  const filterButtons: { label: string; value: Filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'inprog' },
    { label: 'Done', value: 'done' },
  ]

  function toggleInSet(setter: (updater: (prev: Set<string>) => Set<string>) => void, key: string) {
    setter(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allReleases = Array.from(
    new Set(Object.values(bugsGrouped).flat().flatMap(bug => bug.fields.fixVersions.map(v => v.name)))
  ).sort()

  function applyBugFilters(bugs: JiraBug[]): JiraBug[] {
    const query = bugSearch.trim().toLowerCase()
    return bugs.filter(bug => {
      const sc = statusClass(bug.fields.status.statusCategory.key)
      const statusKey = sc === 'done' ? 'pending' : sc
      if (!bugStatusFilter.has(statusKey)) return false
      if (bugReleaseFilter !== 'all') {
        if (bugReleaseFilter === 'unassigned') {
          if (bug.fields.fixVersions.length > 0) return false
        } else if (!bug.fields.fixVersions.some(v => v.name === bugReleaseFilter)) {
          return false
        }
      }
      if (query) {
        const haystack = `${bug.fields.summary} ${bug.key} ${bug.fields.assignee?.displayName ?? ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }

  // Board: hide done epics with no due date, or due date before today
  const todayMs = new Date(today).getTime()
  const boardGrouped = Object.fromEntries(
    Object.entries(grouped).map(([k, epics]) => [
      k,
      epics.filter(epic => {
        if (statusClass(epic.fields.status.statusCategory.key) !== 'done') return true
        if (!epic.fields.duedate) return false
        return new Date(epic.fields.duedate).getTime() >= todayMs
      }),
    ])
  ) as Record<string, JiraEpic[]>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center gap-4 sticky top-0 z-10">
        <h1 className="text-[17px] font-bold text-slate-900">AJC Product Roadmap</h1>

        <div className="flex gap-1 ml-2">
          {(['gantt', 'board', 'bugs'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                tab === t
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {t === 'board' ? 'Board' : t === 'bugs' ? 'Bugs' : 'Timeline'}
            </button>
          ))}
        </div>

        {fetchedAt && (
          <span className="text-[11px] text-slate-400 ml-auto">
            Updated {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </header>

      {error && (
        <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠ Could not load Jira data: {error}
        </div>
      )}

      {tab === 'board' && (
        <>
          <div className="px-5 pt-4 pb-3 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Status</span>
            {filterButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value)}
                className={`px-3 py-1 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                  filter === btn.value
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 px-5 pb-8">
            {SQUADS.map(squad => (
              <SquadColumn
                key={squad.key}
                squad={squad}
                epics={boardGrouped[squad.key] ?? []}
                storiesByEpic={storiesByEpic}
                commentSummaries={commentSummaries}
                filter={filter}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'gantt' && (
        <div className="pt-4">
          <GanttView grouped={grouped} today={today} />
        </div>
      )}

      {tab === 'bugs' && (
        <>
          <div className="px-5 pt-4 pb-3 flex items-center gap-2 flex-wrap">
            <FilterDropdown
              label="Status"
              options={BUG_STATUS_OPTIONS}
              selected={bugStatusFilter}
              onToggle={key => toggleInSet(setBugStatusFilter, key)}
            />

            <FilterDropdown
              label="Project"
              options={SQUADS.map(s => ({ key: s.key, label: s.name, color: s.color }))}
              selected={bugProjectFilter}
              onToggle={key => toggleInSet(setBugProjectFilter, key)}
            />

            <select
              value={bugReleaseFilter}
              onChange={e => setBugReleaseFilter(e.target.value)}
              className="text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-white hover:border-slate-400 focus:outline-none focus:border-slate-500 cursor-pointer"
            >
              <option value="all">All Releases</option>
              <option value="unassigned">Unassigned</option>
              {allReleases.map(release => (
                <option key={release} value={release}>{release}</option>
              ))}
            </select>

            <div className="relative ml-auto">
              <input
                type="text"
                value={bugSearch}
                onChange={e => setBugSearch(e.target.value)}
                placeholder="Search bugs…"
                className="text-[12px] text-slate-700 border border-slate-200 rounded-md pl-3 pr-7 py-1 bg-white hover:border-slate-400 focus:outline-none focus:border-slate-500 w-56"
              />
              {bugSearch && (
                <button
                  onClick={() => setBugSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 cursor-pointer leading-none"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-5 pb-8">
            {SQUADS.filter(squad => bugProjectFilter.has(squad.key)).map(squad => (
              <BugColumn key={squad.key} squad={squad} bugs={applyBugFilters(bugsGrouped[squad.key] ?? [])} />
            ))}
            {bugProjectFilter.size === 0 && (
              <p className="col-span-2 text-center text-sm text-slate-400 py-12">
                No boards selected. Pick at least one project above.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
