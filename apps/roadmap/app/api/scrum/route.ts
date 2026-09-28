import { NextResponse } from 'next/server'
import { computeAllScrumStats } from '@/lib/scrum'

export async function GET() {
  try {
    const squads = await computeAllScrumStats()
    return NextResponse.json({ squads, fetchedAt: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
