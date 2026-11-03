import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { computeAllScrumStats } from '@/lib/scrum'

// One cache entry for the whole result instead of one Data Cache entry per Jira fetch
const getScrumStats = unstable_cache(computeAllScrumStats, ['scrum-stats'], { revalidate: 3600 })

export async function GET() {
  try {
    const squads = await getScrumStats()
    return NextResponse.json({ squads, fetchedAt: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
