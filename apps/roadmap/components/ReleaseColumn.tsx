'use client'

import { useState } from 'react'
import type { JiraRelease, JiraReleaseIssue } from '@/lib/jira'
import { statusClass } from '@/lib/jira'
import type { Squad } from './SquadColumn'

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function releaseBadge(release: JiraRelease): { label: string; className: string } {
  if (release.released) return { label: 'Released', className: 'bg-green-50 text-green-700' }
  if (release.overdue) return { label: 'Overdue', className: 'bg-red-50 text-red-700' }
  return { label: 'Upcoming', className: 'bg-blue-50 text-blue-700' }
}

const STATUS_LABELS: Record<'todo' | 'inprog' | 'done', string> = {
  todo: 'To Do',
  inprog: 'In Progress',
  done: 'Done',
}

const STATUS_CLASSES: Record<'todo' | 'inprog' | 'done', string> = {
  todo: 'bg-slate-100 text-slate-500',
  inprog: 'bg-amber-50 text-amber-800',
  done: 'bg-green-50 text-green-700',
}

function IssueRow({ issue }: { issue: JiraReleaseIssue }) {
  const sc = statusClass(issue.fields.status.statusCategory.key)
  return (
    <div className="flex items-center gap-2 py-1.5 border-t border-slate-100 first:border-t-0">
      <a
        href={issue.webUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-semibold text-slate-800 leading-snug flex-1 truncate hover:text-blue-600"
        title={issue.fields.summary}
      >
        {issue.fields.summary}
      </a>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASSES[sc]}`}>
        {STATUS_LABELS[sc]}
      </span>
      {issue.fields.assignee?.displayName && (
        <span className="text-[11px] text-slate-400 truncate max-w-[90px]">{issue.fields.assignee.displayName}</span>
      )}
      <span className="font-mono text-[11px] text-slate-300 flex-shrink-0">{issue.key}</span>
    </div>
  )
}

function ReleaseCard({ release }: { release: JiraRelease }) {
  const [expanded, setExpanded] = useState(false)
  const badge = releaseBadge(release)

  return (
    <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-bold text-slate-800">{release.name}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
        <span>{formatDate(release.releaseDate)}</span>
        <span className="text-slate-300">·</span>
        <span>{release.issues.length} ticket{release.issues.length === 1 ? '' : 's'}</span>
      </div>

      {release.issues.length > 0 && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? 'Hide tickets' : 'Show tickets'}
        </button>
      )}

      {expanded && release.issues.length > 0 && (
        <div className="mt-1.5 pt-1 border-t border-slate-100 flex flex-col">
          {release.issues.map(issue => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ReleaseColumn({ squad, releases }: { squad: Squad; releases: JiraRelease[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b-4 flex items-center gap-2" style={{ borderBottomColor: squad.color }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: squad.color }} />
        <span className="text-sm font-bold text-slate-800">{squad.name}</span>
        <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {releases.length}
        </span>
      </div>

      <div className="p-2 flex flex-col gap-2 flex-1">
        {releases.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-6 leading-relaxed">
            <div className="text-2xl mb-2">🚀</div>
            <strong className="text-slate-500">No releases to show</strong>
          </div>
        )}
        {releases.map(release => (
          <ReleaseCard key={release.id} release={release} />
        ))}
      </div>
    </div>
  )
}
