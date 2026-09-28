import { DashboardDataProvider } from '@/components/DashboardDataProvider'
import {
  fetchEpics,
  fetchEpicChildren,
  fetchBugs,
  fetchReleases,
  groupByProject,
  groupBugsByProject,
  groupReleasesByProject,
} from '@/lib/jira'
import { summarizeStoryComments } from '@/lib/ai'
import type { JiraStory, JiraBug, JiraRelease } from '@/lib/jira'

export const revalidate = 300

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let grouped: Record<string, never[]> = { CORE: [], EPS: [], MPS: [], MA: [] }
  const storiesByEpic: Record<string, JiraStory[]> = {}
  let commentSummaries: Record<string, string | null> = {}
  let bugsGrouped: Record<string, JiraBug[]> = { CORE: [], EPS: [], MPS: [], MA: [] }
  let releasesGrouped: Record<string, JiraRelease[]> = { CORE: [], EPS: [], MPS: [], MA: [] }
  let fetchedAt: string | null = null
  let error: string | null = null
  const today = new Date().toISOString()

  try {
    const [epics, bugs, releases] = await Promise.all([fetchEpics(), fetchBugs(), fetchReleases()])
    grouped = groupByProject(epics) as typeof grouped
    bugsGrouped = groupBugsByProject(bugs)
    releasesGrouped = groupReleasesByProject(releases)
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

    // Summarize comments via AI — one batched call, results cached with the layout
    commentSummaries = await summarizeStoryComments(storiesByEpic)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <DashboardDataProvider
      data={{ grouped, storiesByEpic, commentSummaries, bugsGrouped, releasesGrouped, fetchedAt, today, error }}
    >
      {children}
    </DashboardDataProvider>
  )
}
