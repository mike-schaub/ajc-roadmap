import { NextResponse, type NextRequest } from 'next/server'
import { BOARD_IDS } from '@/lib/scrum'
import { fetchSprintReport } from '@/lib/sprints'

export async function GET(request: NextRequest) {
  const squad = request.nextUrl.searchParams.get('squad') ?? ''
  const sprintId = Number(request.nextUrl.searchParams.get('sprintId'))
  const active = request.nextUrl.searchParams.get('active') === 'true'
  if (!(squad in BOARD_IDS) || !Number.isInteger(sprintId) || sprintId <= 0) {
    return NextResponse.json({ error: 'Invalid squad or sprintId' }, { status: 400 })
  }
  try {
    return NextResponse.json({ report: await fetchSprintReport(squad, sprintId, active) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
