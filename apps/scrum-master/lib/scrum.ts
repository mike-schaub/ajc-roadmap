export interface Squad {
  key: string
  name: string
  color: string
}

export const JIRA_BASE = 'https://ajc.atlassian.net/rest/api/3'
export const AGILE_BASE = 'https://ajc.atlassian.net/rest/agile/1.0'

// The "In Progress" status (Jira's built-in id 3) is the dev column on every
// squad board, even though each board renames it ("Developing", "In Development", ...).
const DEV_STATUS_ID = '3'
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const DONE_WINDOW_DAYS = 90
const MS_PER_DAY = 1000 * 60 * 60 * 24

export const BOARD_IDS: Record<string, number> = {
  CORE: 1235,
  EPS: 1268,
  MPS: 1269,
  MA: 739,
}

export function authHeader() {
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN
  if (!email || !token) throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set in .env.local')
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
}

interface BoardColumn {
  name: string
  statusIds: string[]
}

async function fetchBoardColumns(boardId: number): Promise<BoardColumn[]> {
  const res = await fetch(`${AGILE_BASE}/board/${boardId}/configuration`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Jira board config error: ${res.status} ${res.statusText}`)
  const data = await res.json()
  const columns = data.columnConfig?.columns ?? []
  return columns.map((c: { name: string; statuses?: { id: string }[] }) => ({
    name: c.name,
    statusIds: (c.statuses ?? []).map(s => s.id),
  }))
}

interface TicketBasic {
  key: string
  webUrl: string
  fields: {
    summary: string
    status: { id: string; name: string }
    assignee: { displayName: string } | null
    created: string
  }
}

async function fetchInFlightTickets(projectKey: string): Promise<TicketBasic[]> {
  const jql = `project = ${projectKey} AND issuetype in (Story, Task, Bug) AND statusCategory = "In Progress" ORDER BY updated DESC`
  const res = await fetch(`${JIRA_BASE}/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql,
      fields: ['summary', 'status', 'assignee', 'created'],
      maxResults: 100,
    }),
    next: { revalidate: 900 },
  })
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return (data.issues || []).map((issue: TicketBasic) => ({
    ...issue,
    webUrl: `https://ajc.atlassian.net/browse/${issue.key}`,
  }))
}

interface StatusTransition {
  created: string
  fromId: string | null
  toId: string
}

interface DoneTicket {
  key: string
  resolvedAt: number
  transitions: StatusTransition[]
}

function extractTransitions(histories: { created: string; items?: { field: string; from?: string | null; to: string }[] }[]): StatusTransition[] {
  const transitions: StatusTransition[] = []
  for (const history of histories) {
    for (const item of history.items ?? []) {
      if (item.field === 'status') {
        transitions.push({ created: history.created, fromId: item.from ?? null, toId: item.to })
      }
    }
  }
  return transitions.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
}

// One search with the changelog expanded, instead of a changelog call per ticket.
// Done time is the status-category change date: this Jira never populates resolutiondate.
async function fetchRecentlyDoneTickets(projectKey: string): Promise<DoneTicket[]> {
  const jql = `project = ${projectKey} AND issuetype in (Story, Task, Bug) AND statusCategory = Done AND statusCategoryChangedDate >= -${DONE_WINDOW_DAYS}d`
  const tickets: DoneTicket[] = []
  let nextPageToken: string | undefined
  do {
    const res = await fetch(`${JIRA_BASE}/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jql, fields: ['statuscategorychangedate'], expand: 'changelog', maxResults: 100, nextPageToken }),
      next: { revalidate: 900 },
    })
    if (!res.ok) throw new Error(`Jira API error (done tickets): ${res.status} ${res.statusText}`)
    const data = await res.json()
    for (const issue of data.issues ?? []) {
      if (!issue.fields.statuscategorychangedate) continue
      tickets.push({
        key: issue.key,
        resolvedAt: new Date(issue.fields.statuscategorychangedate).getTime(),
        transitions: extractTransitions(issue.changelog?.histories ?? []),
      })
    }
    nextPageToken = data.isLast ? undefined : data.nextPageToken
  } while (nextPageToken)
  return tickets
}

async function fetchStatusTransitions(issueKey: string): Promise<StatusTransition[]> {
  const transitions: StatusTransition[] = []
  let startAt = 0
  for (;;) {
    const res = await fetch(
      `${JIRA_BASE}/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=100`,
      { headers: { Authorization: authHeader(), Accept: 'application/json' }, next: { revalidate: 900 } }
    )
    if (!res.ok) throw new Error(`Jira changelog error for ${issueKey}: ${res.status} ${res.statusText}`)
    const data = await res.json()
    for (const history of data.values ?? []) {
      for (const item of history.items ?? []) {
        if (item.field === 'status') {
          transitions.push({ created: history.created, fromId: item.from ?? null, toId: item.to })
        }
      }
    }
    if (data.isLast || (data.values ?? []).length === 0) break
    startAt += data.values.length
  }
  return transitions.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
}

// Runs async tasks with a bounded number in flight at once.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export interface StatusDuration {
  columnName: string
  avgDays: number
  ticketCount: number
}

export interface StaleTicket {
  key: string
  webUrl: string
  summary: string
  status: string
  assignee: string | null
  daysStuck: number
}

export interface CycleTimeStat {
  medianDays: number
  avgDays: number
}

export interface SquadScrumStats {
  inFlightCount: number
  statusDurations: StatusDuration[]
  staleTickets: StaleTicket[]
  // Both computed from tickets done in the last DONE_WINDOW_DAYS days.
  doneWindowDays: number
  doneCount: number
  // In Progress -> Done; null when no done ticket ever entered the dev column.
  cycleTime: CycleTimeStat | null
  sentBackCount: number
  sentBackPct: number | null
}

function columnIndexForStatus(columns: BoardColumn[], statusId: string): number {
  return columns.findIndex(c => c.statusIds.includes(statusId))
}

function columnNameForStatus(columns: BoardColumn[], statusId: string): string {
  return columns.find(c => c.statusIds.includes(statusId))?.name ?? 'Unknown'
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Cycle time runs from the first move into the dev column (or any later one, if
// a ticket skipped it) to resolution. "Sent back" = moved into dev from a later column.
function computeDoneStats(doneTickets: DoneTicket[], columns: BoardColumn[], devColumnIndex: number) {
  const cycleDays: number[] = []
  let sentBackCount = 0

  for (const ticket of doneTickets) {
    let startedAt: number | null = null
    let sentBack = false
    let currentIdx = ticket.transitions[0]?.fromId ? columnIndexForStatus(columns, ticket.transitions[0].fromId) : -1

    for (const t of ticket.transitions) {
      const toIdx = columnIndexForStatus(columns, t.toId)
      if (startedAt === null && devColumnIndex >= 0 && toIdx >= devColumnIndex) {
        startedAt = new Date(t.created).getTime()
      }
      if (devColumnIndex >= 0 && t.toId === DEV_STATUS_ID && currentIdx > devColumnIndex) {
        sentBack = true
      }
      currentIdx = toIdx
    }

    if (sentBack) sentBackCount++
    if (startedAt !== null && ticket.resolvedAt >= startedAt) {
      cycleDays.push((ticket.resolvedAt - startedAt) / MS_PER_DAY)
    }
  }

  return {
    doneCount: doneTickets.length,
    cycleTime: cycleDays.length
      ? { medianDays: median(cycleDays), avgDays: cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length }
      : null,
    sentBackCount,
    sentBackPct: doneTickets.length ? (sentBackCount / doneTickets.length) * 100 : null,
  }
}

export async function computeSquadScrumStats(projectKey: string): Promise<SquadScrumStats> {
  const boardId = BOARD_IDS[projectKey]
  if (!boardId) throw new Error(`No board configured for squad ${projectKey}`)

  const [columns, tickets, doneTickets] = await Promise.all([
    fetchBoardColumns(boardId),
    fetchInFlightTickets(projectKey),
    fetchRecentlyDoneTickets(projectKey),
  ])

  const devColumnIndex = columns.findIndex(c => c.statusIds.includes(DEV_STATUS_ID))
  const now = Date.now()

  // columnName -> all completed day-durations tickets have spent in it
  const durationsByColumn = new Map<string, number[]>()
  const staleTickets: StaleTicket[] = []

  const transitionsByTicket = await mapWithConcurrency(tickets, 8, ticket => fetchStatusTransitions(ticket.key))

  tickets.forEach((ticket, i) => {
    const transitions = transitionsByTicket[i]

    let cursorTime = new Date(ticket.fields.created).getTime()
    let cursorStatusId = transitions[0]?.fromId ?? ticket.fields.status.id

    for (const t of transitions) {
      const days = (new Date(t.created).getTime() - cursorTime) / (1000 * 60 * 60 * 24)
      const colName = columnNameForStatus(columns, cursorStatusId)
      durationsByColumn.set(colName, [...(durationsByColumn.get(colName) ?? []), days])

      cursorTime = new Date(t.created).getTime()
      cursorStatusId = t.toId
    }

    // Current (still open) segment
    const currentColIndex = columnIndexForStatus(columns, cursorStatusId)
    const daysSinceLastMove = (now - cursorTime) / (1000 * 60 * 60 * 24)
    if (currentColIndex > 0 && now - cursorTime > STALE_AFTER_MS) {
      staleTickets.push({
        key: ticket.key,
        webUrl: ticket.webUrl,
        summary: ticket.fields.summary,
        status: ticket.fields.status.name,
        assignee: ticket.fields.assignee?.displayName ?? null,
        daysStuck: Math.round(daysSinceLastMove),
      })
    }
  })

  // The last column is Done: time spent there is meaningless, and only shows up
  // when a closed ticket gets reopened.
  const statusDurations: StatusDuration[] = columns
    .slice(0, -1)
    .map(col => {
      const durations = durationsByColumn.get(col.name)
      if (!durations || durations.length === 0) return null
      const avgDays = durations.reduce((sum, d) => sum + d, 0) / durations.length
      return { columnName: col.name, avgDays, ticketCount: durations.length }
    })
    .filter((d): d is StatusDuration => d !== null)

  staleTickets.sort((a, b) => b.daysStuck - a.daysStuck)

  const doneStats = computeDoneStats(doneTickets, columns, devColumnIndex)

  return {
    inFlightCount: tickets.length,
    statusDurations,
    staleTickets,
    doneWindowDays: DONE_WINDOW_DAYS,
    ...doneStats,
  }
}

export async function computeAllScrumStats(): Promise<Record<string, SquadScrumStats>> {
  const squadKeys = Object.keys(BOARD_IDS)
  const results = await Promise.all(squadKeys.map(key => computeSquadScrumStats(key)))
  return Object.fromEntries(squadKeys.map((key, i) => [key, results[i]]))
}
