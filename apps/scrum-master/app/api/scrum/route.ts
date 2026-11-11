import { NextResponse } from 'next/server'
import { computeAllScrumStats } from '@/lib/scrum'
import { withFreshness } from '@/lib/freshness'

export async function GET() {
  try {
    const { result: squads, dataAsOf } = await withFreshness(computeAllScrumStats)
    return NextResponse.json({ squads, dataAsOf })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
