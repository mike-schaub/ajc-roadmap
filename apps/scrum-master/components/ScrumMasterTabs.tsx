'use client'

import { useState } from 'react'
import type { Squad } from '@/lib/scrum'
import { ScrumMasterView } from '@/components/ScrumMasterView'
import { SprintView } from '@/components/SprintView'

const VIEWS = [
  { key: 'sprints', label: 'Sprints' },
  { key: 'flow', label: 'Flow metrics' },
] as const

export function ScrumMasterTabs({ squads }: { squads: Squad[] }) {
  const [view, setView] = useState<(typeof VIEWS)[number]['key']>('sprints')

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-2 text-sm font-semibold -mb-px border-b-2 ${
              view === v.key ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {/* Both stay mounted so switching tabs doesn't refetch. */}
      <div hidden={view !== 'sprints'}>
        <SprintView squads={squads} />
      </div>
      <div hidden={view !== 'flow'}>
        <ScrumMasterView squads={squads} />
      </div>
    </div>
  )
}
