'use client'

import { useState } from 'react'
import type { JiraEpic } from '@/lib/jira'
import { SquadColumn } from './SquadColumn'
import type { Squad } from './SquadColumn'

const SQUADS: Squad[] = [
  { key: 'CORE', name: 'Core Products',    color: '#3b82f6' },
  { key: 'EPS',  name: 'Emerging Products', color: '#1AA368' },
  { key: 'MPS',  name: 'Monetization',      color: '#f59e0b' },
  { key: 'MA',   name: 'Mobile App',        color: '#004FFF' },
]

type Filter = 'all' | 'todo' | 'inprog' | 'done'

export function RoadmapDashboard({
  grouped,
  fetchedAt,
  error,
}: {
  grouped: Record<string, JiraEpic[]>
  fetchedAt: string | null
  error: string | null
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const filterButtons: { label: string; value: Filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'inprog' },
    { label: 'Done', value: 'done' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-[17px] font-bold text-slate-900">AJC Product Roadmap Q2 2026</h1>
        {fetchedAt && (
          <span className="text-[11px] text-slate-400">
            Updated {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </header>

      {error && (
        <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠ Could not load Jira data: {error}
        </div>
      )}

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
            epics={grouped[squad.key] ?? []}
            filter={filter}
          />
        ))}
      </div>
    </div>
  )
}
