'use client'

import { useState } from 'react'
import type { JiraEpic, JiraStory } from '@/lib/jira'
import { statusClass } from '@/lib/jira'

const STATUS_LABELS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-500',
  inprog: 'bg-amber-50 text-amber-800',
  done: 'bg-green-50 text-green-700',
}

const STORY_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-200',
  inprog: 'bg-amber-400',
  done: 'bg-green-500',
}

const PRIORITY_DOTS: Record<string, string> = {
  critical: 'bg-red-500',
  highest: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-slate-300',
}

const STUCK_DAYS = 10

// Explicit sort order by status name; falls back to category rank for unknowns
const STATUS_SORT_ORDER: Record<string, number> = {
  'to do': 0,
  'in progress': 1,
  'in test': 2,
  'deployed': 3,
}

function storyOrder(story: JiraStory): number {
  const byName = STATUS_SORT_ORDER[story.fields.status.name.toLowerCase()]
  if (byName !== undefined) return byName
  // fallback: category rank keeps unknowns grouped sensibly
  const cat = statusClass(story.fields.status.statusCategory.key)
  return cat === 'todo' ? 10 : cat === 'inprog' ? 11 : 12
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export function EpicCard({
  epic,
  stories,
  commentSummaries,
}: {
  epic: JiraEpic
  stories: JiraStory[]
  commentSummaries: Record<string, string | null>
}) {
  const sc = statusClass(epic.fields.status.statusCategory.key)
  const priority = (epic.fields.priority?.name ?? 'low').toLowerCase()
  const dotColor = PRIORITY_DOTS[priority] ?? PRIORITY_DOTS.low

  const [expanded, setExpanded] = useState(false)

  const total = stories.length
  const done = stories.filter(s => statusClass(s.fields.status.statusCategory.key) === 'done').length
  const inprog = stories.filter(s => statusClass(s.fields.status.statusCategory.key) === 'inprog').length
  const stuck = stories.filter(s => {
    if (statusClass(s.fields.status.statusCategory.key) !== 'inprog') return false
    return daysSince(s.fields.updated) >= STUCK_DAYS
  })

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-all">
      {/* Main card row */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <a
            href={epic.webUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-slate-800 leading-snug flex-1 hover:text-blue-600"
          >
            {epic.fields.summary}
          </a>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${STATUS_LABELS[sc]}`}>
            {epic.fields.status.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} title={epic.fields.priority?.name ?? 'Low'} />
          {(epic.fields.startdate || epic.fields.duedate) && (
            <span className="whitespace-nowrap">
              {epic.fields.startdate && epic.fields.duedate
                ? `${fmt(epic.fields.startdate)} → ${fmt(epic.fields.duedate)}`
                : epic.fields.startdate
                ? `From ${fmt(epic.fields.startdate)}`
                : `Due ${fmt(epic.fields.duedate!)}`}
            </span>
          )}
          <span className="font-mono text-slate-300 ml-auto">{epic.key}</span>
        </div>

        {total > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400">
                {done}/{total} done{inprog > 0 ? `, ${inprog} in progress` : ''}
              </span>
              {stuck.length > 0 && (
                <span className="text-[10px] font-semibold text-red-500">
                  {stuck.length} stuck &gt;{STUCK_DAYS}d
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden flex">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${(inprog / total) * 100}%` }} />
            </div>
          </div>
        )}

        {total > 0 && (
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {expanded ? 'Hide stories' : 'Show stories'}
          </button>
        )}
      </div>

      {/* Expanded story list */}
      {expanded && total > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5">
          <div className="flex flex-col gap-1.5">
            {[...stories].sort((a, b) => storyOrder(a) - storyOrder(b)).map(story => {
              const ssc = statusClass(story.fields.status.statusCategory.key)
              const isStuck = ssc === 'inprog' && daysSince(story.fields.updated) >= STUCK_DAYS
              const summary = commentSummaries[story.key] ?? null

              return (
                <div
                  key={story.id}
                  className={`rounded-md px-2.5 py-2 bg-white border ${isStuck ? 'border-red-200' : 'border-slate-100'}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${STORY_STATUS_COLORS[ssc]}`}
                      title={story.fields.status.name}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={story.webUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-slate-700 hover:text-blue-600 leading-snug"
                        >
                          {story.fields.summary}
                        </a>
                        {isStuck && (
                          <span className="flex-shrink-0 text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                            stuck {daysSince(story.fields.updated)}d
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        <span className="font-mono text-slate-300">{story.key}</span>
                        <span className="ml-auto">{story.fields.status.name}</span>
                      </div>
                      {summary && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                          <p className="text-[10px] text-slate-500 leading-relaxed">{summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
