import { RoadmapDashboard } from '@/components/RoadmapDashboard'
import { fetchEpics, fetchEpicChildren, groupByProject } from '@/lib/jira'
import { summarizeStoryComments } from '@/lib/ai'
import type { JiraStory } from '@/lib/jira'

export const revalidate = 300

export default async function HomePage() {
  let grouped: Record<string, never[]> = { CORE: [], EPS: [], MPS: [], MA: [] }
  let storiesByEpic: Record<string, JiraStory[]> = {}
  let commentSummaries: Record<string, string | null> = {}
  let fetchedAt: string | null = null
  let error: string | null = null
  const today = new Date().toISOString()

  try {
    const epics = await fetchEpics()
    grouped = groupByProject(epics) as typeof grouped
    fetchedAt = today

    // Fetch all child stories in parallel
    const results = await Promise.allSettled(
      epics.map(epic => fetchEpicChildren(epic.key).then(stories => ({ key: epic.key, stories })))
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        storiesByEpic[result.value.key] = result.value.stories
      }
    }

    // Summarize comments via AI — one batched call, results cached with the page
    commentSummaries = await summarizeStoryComments(storiesByEpic)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <RoadmapDashboard
      grouped={grouped}
      storiesByEpic={storiesByEpic}
      commentSummaries={commentSummaries}
      fetchedAt={fetchedAt}
      today={today}
      error={error}
    />
  )
}
