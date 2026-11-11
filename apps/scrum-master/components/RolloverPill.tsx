export function RolloverPill({ sprints }: { sprints: string[] }) {
  if (sprints.length === 0) return null
  const times = sprints.length
  const tone = times >= 2 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span
      title={`Rolled over ${times} time${times === 1 ? '' : 's'}: ${sprints.join(' → ')} → current sprint`}
      className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${tone}`}
    >
      ↻ {times}×
    </span>
  )
}
