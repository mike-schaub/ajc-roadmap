'use client'

import { useState } from 'react'
import type { JiraEpic } from '@/lib/jira'
import { statusClass } from '@/lib/jira'

const SQUADS = [
  { key: 'CORE', name: 'Core Products',     color: '#3b82f6' },
  { key: 'EPS',  name: 'Emerging Products', color: '#1AA368' },
  { key: 'MPS',  name: 'Monetization',      color: '#f59e0b' },
  { key: 'MA',   name: 'Mobile App',        color: '#004FFF' },
]

function pct(date: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime()
  return Math.max(0, Math.min(100, ((date.getTime() - start.getTime()) / total) * 100))
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Avoid timezone off-by-one: parse/format dates in local time
function toInputDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function fromInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function GanttView({
  grouped,
  today,
}: {
  grouped: Record<string, JiraEpic[]>
  today: string
}) {
  const todayDate = new Date(today)

  // Default: today → +6 months
  const defaultEnd = new Date(todayDate)
  defaultEnd.setMonth(defaultEnd.getMonth() + 6)

  const [rangeStart, setRangeStart] = useState(todayDate)
  const [rangeEnd, setRangeEnd] = useState(defaultEnd)

  const todayPct = pct(todayDate, rangeStart, rangeEnd)
  const showToday = todayPct > 0 && todayPct < 100

  // Month markers — add year label when crossing into a new year
  const months: { label: string; left: number }[] = []
  const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
  let lastYear = -1
  while (cur <= rangeEnd) {
    const showYear = cur.getFullYear() !== lastYear && (cur.getMonth() !== rangeStart.getMonth() || cur.getFullYear() !== rangeStart.getFullYear())
    lastYear = cur.getFullYear()
    months.push({
      label: cur.toLocaleDateString('en-US', { month: 'short' }) + (showYear && cur.getMonth() === 0 ? ` '${String(cur.getFullYear()).slice(2)}` : ''),
      left: pct(cur, rangeStart, rangeEnd),
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  const rows = SQUADS.flatMap(squad =>
    (grouped[squad.key] ?? []).map(epic => ({ epic, squad }))
  )

  const dated = rows
    .filter(({ epic }) => epic.fields.startdate || epic.fields.duedate)
    .sort((a, b) => {
      const aDate = a.epic.fields.startdate ?? a.epic.fields.duedate ?? ''
      const bDate = b.epic.fields.startdate ?? b.epic.fields.duedate ?? ''
      return aDate.localeCompare(bDate)
    })

  const undated = rows.filter(({ epic }) => !epic.fields.startdate && !epic.fields.duedate)

  return (
    <div className="px-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <h2 className="text-sm font-bold text-slate-700">Timeline</h2>

        {/* Date range pickers */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">From</label>
          <input
            type="date"
            value={toInputDate(rangeStart)}
            max={toInputDate(rangeEnd)}
            onChange={e => e.target.value && setRangeStart(fromInputDate(e.target.value))}
            className="text-[12px] text-slate-700 border border-slate-200 rounded px-2 py-1 bg-white hover:border-slate-400 focus:outline-none focus:border-slate-500 cursor-pointer"
          />
          <span className="text-slate-300">→</span>
          <input
            type="date"
            value={toInputDate(rangeEnd)}
            min={toInputDate(rangeStart)}
            onChange={e => e.target.value && setRangeEnd(fromInputDate(e.target.value))}
            className="text-[12px] text-slate-700 border border-slate-200 rounded px-2 py-1 bg-white hover:border-slate-400 focus:outline-none focus:border-slate-500 cursor-pointer"
          />
          <button
            onClick={() => { setRangeStart(todayDate); setRangeEnd(defaultEnd) }}
            className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 cursor-pointer"
          >
            Reset
          </button>
        </div>

        {/* Squad legend */}
        <div className="ml-auto flex gap-4">
          {SQUADS.map(s => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Column header */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <div className="w-56 flex-shrink-0 px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-r border-slate-200">
            Epic
          </div>
          <div className="flex-1 relative" style={{ height: '32px' }}>
            {months.map(m => (
              <span
                key={`${m.label}-${m.left}`}
                className="absolute top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide"
                style={{ left: `${m.left}%`, paddingLeft: '6px' }}
              >
                {m.label}
              </span>
            ))}
            {months.slice(1).map(m => (
              <div
                key={`div-${m.label}-${m.left}`}
                className="absolute top-0 bottom-0 w-px bg-slate-200"
                style={{ left: `${m.left}%` }}
              />
            ))}
          </div>
        </div>

        {dated.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-12">
            No epics have start or due dates set. Add dates in Jira to see them here.
          </div>
        )}

        {dated.map(({ epic, squad }, i) => {
          const startDate = epic.fields.startdate ? new Date(epic.fields.startdate) : null
          const endDate = epic.fields.duedate ? new Date(epic.fields.duedate) : null
          const barLeft = pct(startDate ?? rangeStart, rangeStart, rangeEnd)
          const barRight = pct(endDate ?? rangeEnd, rangeStart, rangeEnd)
          const barWidth = Math.max(0.5, barRight - barLeft)
          const sc = statusClass(epic.fields.status.statusCategory.key)
          const barOpacity = sc === 'todo' ? 0.4 : sc === 'done' ? 0.55 : 1

          const dateRange = startDate && endDate
            ? `${fmtShort(epic.fields.startdate!)} → ${fmtShort(epic.fields.duedate!)}`
            : startDate
            ? `From ${fmtShort(epic.fields.startdate!)}`
            : `Due ${fmtShort(epic.fields.duedate!)}`

          return (
            <div
              key={epic.id}
              className={`flex items-center border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}
              style={{ minHeight: '36px' }}
            >
              <div className="w-56 flex-shrink-0 px-3 py-1.5 flex items-center gap-2 border-r border-slate-100">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: squad.color }} />
                <a
                  href={epic.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-slate-700 hover:text-blue-600 truncate leading-tight"
                  title={`${epic.fields.summary} · ${dateRange}`}
                >
                  {epic.fields.summary}
                </a>
              </div>

              <div className="flex-1 relative" style={{ height: '36px' }}>
                {months.slice(1).map(m => (
                  <div
                    key={`div-${m.label}-${m.left}`}
                    className="absolute top-0 bottom-0 w-px bg-slate-100"
                    style={{ left: `${m.left}%` }}
                  />
                ))}
                {showToday && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-400/50 z-10"
                    style={{ left: `${todayPct}%` }}
                  />
                )}
                <div
                  className="absolute top-[8px] bottom-[8px] rounded"
                  style={{
                    left: `${barLeft}%`,
                    width: `${barWidth}%`,
                    backgroundColor: squad.color,
                    opacity: barOpacity,
                  }}
                  title={dateRange}
                />
              </div>
            </div>
          )
        })}

        {undated.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              No dates set ({undated.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {undated.map(({ epic, squad }) => (
                <a
                  key={epic.id}
                  href={epic.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 transition-colors"
                  title={epic.fields.summary}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: squad.color }} />
                  <span className="max-w-[220px] truncate">{epic.fields.summary}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
