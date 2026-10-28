'use client'

import { useEffect, useState } from 'react'
import type { Squad } from '@/lib/scrum'
import type { SprintInfo, SprintReport, Tally } from '@/lib/sprints'

interface SquadSprints {
  sprints: SprintInfo[]
  currentSprintId: number | null
  report: SprintReport | null
}

type SprintsResponse =
  | { squads: Record<string, SquadSprints>; fetchedAt: string }
  | { error: string }

const MS_PER_DAY = 1000 * 60 * 60 * 24

function formatRange(sprint: SprintInfo) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${new Date(sprint.startDate).toLocaleDateString([], opts)} – ${new Date(sprint.endDate).toLocaleDateString([], opts)}`
}

function SprintCard({ squad, data }: { squad: Squad; data: SquadSprints }) {
  const [selectedId, setSelectedId] = useState(data.currentSprintId)
  const [reports, setReports] = useState<Record<number, SprintReport>>(
    data.report ? { [data.report.sprintId]: data.report } : {}
  )
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [now] = useState(() => Date.now())

  const sprint = data.sprints.find(s => s.id === selectedId)
  const report = selectedId !== null ? reports[selectedId] : undefined
  const error = selectedId !== null ? errors[selectedId] : undefined

  function selectSprint(id: number) {
    setSelectedId(id)
    setErrors(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => Number(key) !== id)))
    const target = data.sprints.find(s => s.id === id)
    if (!target || reports[id]) return
    setLoadingId(id)
    fetch(`/api/sprints/report?squad=${squad.key}&sprintId=${id}&active=${target.state === 'active'}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) setErrors(prev => ({ ...prev, [id]: json.error }))
        else setReports(prev => ({ ...prev, [id]: json.report }))
      })
      .catch(err => setErrors(prev => ({ ...prev, [id]: err instanceof Error ? err.message : 'Unknown error' })))
      .finally(() => setLoadingId(current => (current === id ? null : current)))
  }

  const isActive = sprint?.state === 'active'
  const daysLeft = sprint && isActive ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - now) / MS_PER_DAY)) : null

  // Squads that don't estimate (no committed points) fall back to ticket counts.
  const unit: 'points' | 'count' = report && report.committed.points > 0 ? 'points' : 'count'
  const val = (t: Tally) => t[unit]
  const pct = report && val(report.committed) > 0 ? (val(report.completedFromCommitted) / val(report.committed)) * 100 : null

  const rows: { label: string; value: number; note?: string }[] = report
    ? [
        { label: 'Committed at start', value: val(report.committed) },
        { label: 'Completed (of committed)', value: val(report.completedFromCommitted) },
        { label: 'Added mid-sprint, completed', value: val(report.completedAdded) },
        { label: isActive ? 'Still open' : 'Not completed', value: val(report.notCompleted) },
        { label: 'Removed from sprint', value: val(report.removed) },
      ]
    : []

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b-4 flex items-center gap-2" style={{ borderBottomColor: squad.color }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: squad.color }} />
        <span className="text-sm font-bold text-slate-800">{squad.name}</span>
        {data.sprints.length > 0 && (
          <select
            aria-label={`${squad.name} sprint`}
            value={selectedId ?? ''}
            onChange={e => selectSprint(Number(e.target.value))}
            className="ml-auto text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 max-w-[55%]"
          >
            {data.sprints.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.state === 'active' ? ' (current)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {data.sprints.length === 0 && <p className="text-xs text-slate-400">No sprints found for this board.</p>}

        {sprint && (
          <p className="text-[11px] text-slate-400">
            {formatRange(sprint)}
            {daysLeft !== null && <> · {daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</>}
            {sprint.state === 'closed' && <> · completed</>}
          </p>
        )}

        {error && <p className="text-xs text-red-600">⚠ Could not load sprint report: {error}</p>}
        {!report && !error && sprint && loadingId === sprint.id && <p className="text-xs text-slate-400">Loading sprint…</p>}

        {report && (
          <>
            <div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-2xl font-bold text-slate-800">{pct === null ? '—' : `${Math.round(pct)}%`}</span>
                <span className="text-[11px] text-slate-500">
                  {val(report.completedFromCommitted)} of {val(report.committed)} committed {unit === 'points' ? 'points' : 'tickets'}{' '}
                  {isActive ? 'done so far' : 'completed'}
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: squad.color }}
                />
              </div>
              {unit === 'count' && (
                <p className="text-[10px] text-slate-400 mt-1">This squad doesn&apos;t estimate in story points, so tickets are counted.</p>
              )}
            </div>

            <div className="flex flex-col divide-y divide-slate-100">
              {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-semibold text-slate-800">{row.value}</span>
                </div>
              ))}
            </div>

            {report.byAssignee.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">By developer</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-slate-400 text-right">
                      <th className="text-left font-medium pb-1">&nbsp;</th>
                      <th className="font-medium pb-1">Assigned</th>
                      <th className="font-medium pb-1">Added</th>
                      <th className="font-medium pb-1">Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byAssignee.map(row => (
                      <tr key={row.name} className="border-t border-slate-100 text-right">
                        <td className="text-left text-slate-700 py-1.5 truncate max-w-[10rem]" title={row.name}>{row.name}</td>
                        <td className="text-slate-800 font-semibold">
                          {val(row.assigned)}
                          {unit === 'points' && <span className="ml-1 font-normal text-slate-400">({row.assigned.count})</span>}
                        </td>
                        <td className="text-slate-500">{val(row.added) || '—'}</td>
                        <td className="text-slate-800 font-semibold">{val(row.completed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-slate-400 mt-1">
                  Assigned = committed at sprint start{unit === 'points' ? ' (ticket count in parentheses)' : ''}. Done includes added work. Uses each ticket&apos;s current assignee.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function SprintView({ squads: squadList }: { squads: Squad[] }) {
  const [data, setData] = useState<SprintsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/sprints')
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

  if (loading) return <p className="text-sm text-slate-400 py-10 text-center">Loading sprints…</p>

  if (!data || 'error' in data) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        ⚠ Could not load sprints: {data?.error ?? 'Unknown error'}
      </div>
    )
  }

  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-3">
        Committed = scope at sprint start. Work added after the start is shown separately and doesn&apos;t count toward the percentage.
      </p>
      <div className="grid grid-cols-2 gap-4 items-start">
        {squadList.map(squad => {
          const squadData = data.squads[squad.key]
          return squadData ? <SprintCard key={squad.key} squad={squad} data={squadData} /> : null
        })}
      </div>
    </div>
  )
}
