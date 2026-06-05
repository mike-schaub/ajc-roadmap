import { RoadmapDashboard } from '@/components/RoadmapDashboard'
import { fetchEpics, groupByProject } from '@/lib/jira'

export const revalidate = 300

export default async function HomePage() {
  let grouped: Record<string, never[]> = { CORE: [], EPS: [], MPS: [], MA: [] }
  let fetchedAt: string | null = null
  let error: string | null = null

  try {
    const epics = await fetchEpics()
    grouped = groupByProject(epics) as typeof grouped
    fetchedAt = new Date().toISOString()
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <RoadmapDashboard
      grouped={grouped}
      fetchedAt={fetchedAt}
      error={error}
    />
  )
}
