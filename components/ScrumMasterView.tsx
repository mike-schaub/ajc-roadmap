'use client'

import { useEffect, useState } from 'react'
import type { Squad } from './SquadColumn'
import type { SquadScrumStats } from '@/lib/scrum'

type ScrumResponse =
  | { squads: Record<string, SquadScrumStats>; fetchedAt: string }
  | { error: string }

function staleBadgeClass(daysStuck: number) {
  return daysStuck > 14
    ? 'bg-red-50 text-red-700'
    : 'bg-amber-50 text-amber-800'
}

export function ScrumMasterView({ squads: squadList }: { squads: Squad[] }) {
  const [data, setData] = useState<ScrumResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/scrum')
      .then(res => res.json())
      .then(json => {
        if (!cancelled) setData(json)
      })
      .catch(err => {
        if (!cancelled) setData({ error: err instanceof Error ? err.message : 'Unknown error' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-slate-400 py-10 text-center">Crunching ticket history…</p>
  }

  if (!data || 'error' in data) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        ⚠ Could not load scrum stats: {data?.error ?? 'Unknown error'}
      </div>
    )
  }

  const { squads, fetchedAt } = data

  return (
    <div>
      <div className="flex items-center mb-3">
        <p className="text-[11px] text-slate-400">
          Based on tickets currently in flight (past To Do, not yet Done). Updated{' '}
          {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {squadList.map(squad => {
          const stats = squads[squad.key]
          if (!stats) return null
          const maxAvgDays = Math.max(1, ...stats.statusDurations.map(d => d.avgDays))

          return (
            <div key={squad.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b-4 flex items-center gap-2" style={{ borderBottomColor: squad.color }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: squad.color }} />
                <span className="text-sm font-bold text-slate-800">{squad.name}</span>
                <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {stats.inFlightCount} in flight
                </span>
              </div>

              <div className="p-4 flex flex-col gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Avg. time in status</h3>
                  </div>
                  {stats.statusDurations.length === 0 && (
                    <p className="text-xs text-slate-400">No completed status transitions yet.</p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {stats.statusDurations.map(d => (
                      <div key={d.columnName} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-600 w-28 flex-shrink-0 truncate" title={d.columnName}>
                          {d.columnName}
                        </span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${Math.max(4, (d.avgDays / maxAvgDays) * 100)}%`,
                              backgroundColor: squad.color,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 w-14 flex-shrink-0 text-right">
                          {d.avgDays.toFixed(1)}d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                  <span className="text-xl font-bold text-slate-800">{stats.sentBackToDevCount}</span>
                  <span className="text-[11px] text-slate-500 leading-tight">
                    ticket{stats.sentBackToDevCount === 1 ? '' : 's'} sent back to dev<br />after moving on
                  </span>
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Stuck &gt; 1 week ({stats.staleTickets.length})
                  </h3>
                  {stats.staleTickets.length === 0 && (
                    <p className="text-xs text-slate-400">Nothing stuck — nice.</p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {stats.staleTickets.map(ticket => (
                      <a
                        key={ticket.key}
                        href={ticket.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-slate-50 border border-slate-100"
                      >
                        <span className="font-semibold text-slate-500 flex-shrink-0">{ticket.key}</span>
                        <span className="text-slate-700 truncate flex-1">{ticket.summary}</span>
                        <span className="text-slate-400 flex-shrink-0">{ticket.status}</span>
                        <span className={`flex-shrink-0 font-semibold px-1.5 py-0.5 rounded-full ${staleBadgeClass(ticket.daysStuck)}`}>
                          {ticket.daysStuck}d
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
