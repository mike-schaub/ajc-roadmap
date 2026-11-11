import { AGILE_BASE, BOARD_IDS, authHeader } from '@/lib/scrum'
import { trackedFetch } from '@/lib/freshness'
import { rolledOverFrom } from '@/lib/rollover'

const GREENHOPPER_BASE = 'https://ajc.atlassian.net/rest/greenhopper/1.0'
const HISTORY_LIMIT = 13

export interface SprintInfo {
  id: number
  name: string
  state: 'active' | 'closed'
  startDate: string
  endDate: string
}

export interface Tally {
  points: number
  count: number
}

export interface SprintReport {
  sprintId: number
  committed: Tally
  completedFromCommitted: Tally
  completedAdded: Tally
  // Committed work that didn't finish (carried over, or still open in an active sprint).
  notCompleted: Tally
  // Committed work taken out of the sprint.
  removed: Tally
  byAssignee: AssigneeRow[]
  // Committed tickets with no story points (missing or 0 at sprint start); they count as 0 in the point totals.
  unpointedCommitted: number
  // Only tracked for the active sprint; null for closed sprints.
  rollover: Rollover | null
}

export interface RolledOverTicket {
  key: string
  webUrl: string
  summary: string
  status: string
  assignee: string | null
  // Sprints it has already rolled over from, oldest first.
  sprints: string[]
}

export interface Rollover {
  // Not-yet-done tickets in the sprint that were in earlier sprints, most rollovers first.
  open: RolledOverTicket[]
  // Tickets that rolled in but have since been completed.
  doneCount: number
}

// Uses each ticket's current assignee, not who held it at sprint start.
export interface AssigneeRow {
  name: string
  assigned: Tally // committed at sprint start
  added: Tally // added after sprint start (still in the sprint, done or not)
  completed: Tally // finished, whether committed or added
}

// Jira has returned a spurious 401 or 5xx under load; retry briefly before giving up.
async function jiraFetch(url: string, revalidate: number): Promise<Response> {
  let res: Response | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await trackedFetch(url, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
      next: { revalidate },
    })
    if (res.ok || (res.status !== 401 && res.status < 500)) break
    await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
  }
  return res!
}

export async function fetchSprints(squadKey: string): Promise<SprintInfo[]> {
  const boardId = BOARD_IDS[squadKey]
  if (!boardId) throw new Error(`No board configured for squad ${squadKey}`)

  const sprints: SprintInfo[] = []
  let startAt = 0
  for (;;) {
    const res = await jiraFetch(
      `${AGILE_BASE}/board/${boardId}/sprint?state=active,closed&maxResults=50&startAt=${startAt}`,
      900
    )
    if (!res.ok) throw new Error(`Jira sprint list error: ${res.status} ${res.statusText}`)
    const data = await res.json()
    for (const sprint of data.values ?? []) {
      // Boards can list sprints that belong to another board (EPS lists CORE sprints).
      if (sprint.originBoardId !== boardId || !sprint.startDate || !sprint.endDate) continue
      sprints.push({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      })
    }
    if (data.isLast || (data.values ?? []).length === 0) break
    startAt += data.values.length
  }

  return sprints
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, HISTORY_LIMIT)
}

interface ReportIssue {
  key: string
  assigneeName?: string
  estimateStatistic?: { statFieldValue?: { value?: number } }
  currentEstimateStatistic?: { statFieldValue?: { value?: number } }
}

function tally(issues: ReportIssue[], estimate: 'initial' | 'current'): Tally {
  let points = 0
  for (const issue of issues) {
    const stat = estimate === 'initial' ? issue.estimateStatistic : issue.currentEstimateStatistic
    points += stat?.statFieldValue?.value ?? 0
  }
  return { points, count: issues.length }
}

// Uses Jira's internal sprint report (the same data as the Sprint Report in Jira),
// since the public Agile API has no record of scope at sprint start.
export async function fetchSprintReport(squadKey: string, sprintId: number, isActive: boolean): Promise<SprintReport> {
  const boardId = BOARD_IDS[squadKey]
  if (!boardId) throw new Error(`No board configured for squad ${squadKey}`)

  const res = await jiraFetch(
    `${GREENHOPPER_BASE}/rapid/charts/sprintreport?rapidViewId=${boardId}&sprintId=${sprintId}`,
    isActive ? 900 : 86400
  )
  if (!res.ok) throw new Error(`Jira sprint report error: ${res.status} ${res.statusText}`)
  const contents = (await res.json()).contents
  if (!contents) throw new Error('Jira sprint report had no contents')

  const addedRaw = contents.issueKeysAddedDuringSprint ?? {}
  const added = new Set<string>(Array.isArray(addedRaw) ? addedRaw : Object.keys(addedRaw))
  const completed: ReportIssue[] = contents.completedIssues ?? []
  const open: ReportIssue[] = contents.issuesNotCompletedInCurrentSprint ?? []
  const punted: ReportIssue[] = contents.puntedIssues ?? []
  const wasCommitted = (i: ReportIssue) => !added.has(i.key)
  const rollover = isActive ? await fetchRollover(sprintId) : null

  return {
    sprintId,
    committed: tally([...completed, ...open, ...punted].filter(wasCommitted), 'initial'),
    completedFromCommitted: tally(completed.filter(wasCommitted), 'current'),
    completedAdded: tally(completed.filter(i => added.has(i.key)), 'current'),
    notCompleted: tally(open.filter(wasCommitted), 'initial'),
    removed: tally(punted.filter(wasCommitted), 'initial'),
    byAssignee: tallyByAssignee(completed, open, punted, added),
    unpointedCommitted: [...completed, ...open, ...punted]
      .filter(wasCommitted)
      .filter(i => !((i.estimateStatistic?.statFieldValue?.value ?? 0) > 0)).length,
    rollover,
  }
}

interface SprintIssue {
  key: string
  fields: {
    summary: string
    status: { name: string; statusCategory?: { key: string } }
    assignee: { displayName: string } | null
    closedSprints?: { name: string; startDate?: string }[]
  }
}

// The agile API lists a sprint's tickets with the closed sprints each one has been through.
async function fetchRollover(sprintId: number): Promise<Rollover> {
  const issues: SprintIssue[] = []
  for (let startAt = 0; ; ) {
    const res = await jiraFetch(
      `${AGILE_BASE}/sprint/${sprintId}/issue?fields=summary,status,assignee,closedSprints&maxResults=100&startAt=${startAt}`,
      900
    )
    if (!res.ok) throw new Error(`Jira sprint issues error: ${res.status} ${res.statusText}`)
    const data = await res.json()
    issues.push(...(data.issues ?? []))
    startAt += data.issues?.length ?? 0
    if (!data.issues?.length || startAt >= (data.total ?? 0)) break
  }

  const open: RolledOverTicket[] = []
  let doneCount = 0
  for (const issue of issues) {
    const sprints = rolledOverFrom(issue.fields.closedSprints?.map(s => ({ ...s, state: 'closed' })))
    if (sprints.length === 0) continue
    if (issue.fields.status.statusCategory?.key === 'done') {
      doneCount++
      continue
    }
    open.push({
      key: issue.key,
      webUrl: `https://ajc.atlassian.net/browse/${issue.key}`,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName ?? null,
      sprints,
    })
  }
  open.sort((a, b) => b.sprints.length - a.sprints.length || a.key.localeCompare(b.key, undefined, { numeric: true }))
  return { open, doneCount }
}

function tallyByAssignee(completed: ReportIssue[], open: ReportIssue[], punted: ReportIssue[], added: Set<string>): AssigneeRow[] {
  const groups = new Map<string, { assigned: ReportIssue[]; added: ReportIssue[]; completed: ReportIssue[] }>()
  const group = (issue: ReportIssue) => {
    const name = issue.assigneeName || 'Unassigned'
    if (!groups.has(name)) groups.set(name, { assigned: [], added: [], completed: [] })
    return groups.get(name)!
  }

  for (const issue of [...completed, ...open]) {
    if (added.has(issue.key)) group(issue).added.push(issue)
    else group(issue).assigned.push(issue)
  }
  for (const issue of completed) group(issue).completed.push(issue)
  // Removed tickets were committed to someone, so they still count toward what was assigned.
  for (const issue of punted) if (!added.has(issue.key)) group(issue).assigned.push(issue)

  return [...groups.entries()]
    .map(([name, g]) => ({
      name,
      assigned: tally(g.assigned, 'initial'),
      added: tally(g.added, 'current'),
      completed: tally(g.completed, 'current'),
    }))
    .sort((a, b) => b.assigned.points - a.assigned.points || b.assigned.count - a.assigned.count)
}
