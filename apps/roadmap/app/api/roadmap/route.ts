import { NextResponse } from 'next/server'
import { fetchEpics, groupByProject } from '@/lib/jira'

export async function GET() {
  try {
    const epics = await fetchEpics()
    const grouped = groupByProject(epics)
    return NextResponse.json({ grouped, fetchedAt: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
