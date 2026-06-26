import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchEpicChildren } from '@/lib/jira'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await ctx.params
    const stories = await fetchEpicChildren(key)
    return NextResponse.json({ stories })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
