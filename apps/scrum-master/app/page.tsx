import type { Squad } from '@/lib/scrum'
import { ScrumMasterTabs } from '@/components/ScrumMasterTabs'

const SQUADS: Squad[] = [
  { key: 'CORE', name: 'Core Products',     color: '#3b82f6' },
  { key: 'MA',   name: 'Mobile App',        color: '#004FFF' },
  { key: 'EPS',  name: 'Emerging Products', color: '#1AA368' },
  { key: 'MPS',  name: 'Monetization',      color: '#f59e0b' },
]

export default function ScrumMasterPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center gap-4 sticky top-0 z-10">
        <h1 className="text-[17px] font-bold text-slate-900">AJC Scrum Master</h1>
      </header>

      <div className="pt-4 px-5 pb-8">
        <ScrumMasterTabs squads={SQUADS} />
      </div>
    </div>
  )
}
