'use client'

import { useEffect, useRef, useState } from 'react'

export interface FilterDropdownOption {
  key: string
  label: string
  color?: string
}

export function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: FilterDropdownOption[]
  selected: Set<string>
  onToggle: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const summary =
    selected.size === 0
      ? 'None'
      : selected.size === options.length
      ? 'All'
      : selected.size === 1
      ? options.find(o => selected.has(o.key))?.label
      : `${selected.size} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer bg-white ${
          open ? 'border-slate-400' : 'border-slate-200 hover:border-slate-400'
        }`}
      >
        <span className="text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-slate-700">{summary}</span>
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {options.map(opt => (
            <label
              key={opt.key}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(opt.key)}
                onChange={() => onToggle(opt.key)}
                className="rounded border-slate-300 cursor-pointer"
              />
              {opt.color && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
              )}
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
