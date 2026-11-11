import { NextResponse } from 'next/server'
import { BOARD_IDS } from '@/lib/scrum'
import { withFreshness } from '@/lib/freshness'
import { fetchSprints, fetchSprintReport } from '@/lib/sprints'

// Sprint list per squad, plus the report for the default sprint (active, else most recent).
export async function GET() {
  try {
    const squadKeys = Object.keys(BOARD_IDS)
    const { result: results, dataAsOf } = await withFreshness(() => Promise.all(
      squadKeys.map(async key => {
        const sprints = await fetchSprints(key)
        const current = sprints.find(s => s.state === 'active') ?? sprints[0]
        const report = current ? await fetchSprintReport(key, current.id, current.state === 'active') : null
        return { sprints, currentSprintId: current?.id ?? null, report }
      })
    ))
    return NextResponse.json({
      squads: Object.fromEntries(squadKeys.map((key, i) => [key, results[i]])),
      dataAsOf,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
