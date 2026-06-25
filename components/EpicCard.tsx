'use client'

import type { JiraEpic } from '@/lib/jira'
import { statusClass } from '@/lib/jira'

const STATUS_LABELS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-500',
  inprog: 'bg-amber-50 text-amber-800',
  done: 'bg-green-50 text-green-700',
}

const PRIORITY_DOTS: Record<string, string> = {
  critical: 'bg-red-500',
  highest: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-slate-300',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function EpicCard({ epic }: { epic: JiraEpic }) {
  const sc = statusClass(epic.fields.status.statusCategory.key)
  const priority = (epic.fields.priority?.name ?? 'low').toLowerCase()
  const dotColor = PRIORITY_DOTS[priority] ?? PRIORITY_DOTS.low

  return (
    <a
      href={epic.webUrl}
      target="_blank"
      rel="noreferrer"
      className="block border border-slate-200 rounded-lg p-3 hover:shadow-md hover:border-slate-400 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-slate-800 leading-snug flex-1">
          {epic.fields.summary}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${STATUS_LABELS[sc]}`}>
          {epic.fields.status.name}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} title={epic.fields.priority?.name ?? 'Low'} />
        <span>{epic.fields.assignee?.displayName ?? 'Unassigned'}</span>
        {(epic.fields.startdate || epic.fields.duedate) && (
          <span className="ml-auto whitespace-nowrap">
            {epic.fields.startdate && epic.fields.duedate
              ? `${fmt(epic.fields.startdate)} → ${fmt(epic.fields.duedate)}`
              : epic.fields.startdate
              ? `From ${fmt(epic.fields.startdate)}`
              : `Due ${fmt(epic.fields.duedate!)}`}
          </span>
        )}
        <span className={`font-mono text-slate-300 ${!epic.fields.startdate && !epic.fields.duedate ? 'ml-auto' : ''}`}>{epic.key}</span>
      </div>
    </a>
  )
}
