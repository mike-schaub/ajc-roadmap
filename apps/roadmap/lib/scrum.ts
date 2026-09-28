const JIRA_BASE = 'https://ajc.atlassian.net/rest/api/3'
const AGILE_BASE = 'https://ajc.atlassian.net/rest/agile/1.0'

// The "In Progress" status (Jira's built-in id 3) is the dev column on every
// squad board, even though each board renames it ("Developing", "In Development", ...).
const DEV_STATUS_ID = '3'
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

const BOARD_IDS: Record<string, number> = {
  CORE: 1235,
  EPS: 1268,
  MPS: 1269,
  MA: 739,
}

function authHeader() {
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

export interface SquadScrumStats {
  inFlightCount: number
  statusDurations: StatusDuration[]
  sentBackToDevCount: number
  staleTickets: StaleTicket[]
}

function columnIndexForStatus(columns: BoardColumn[], statusId: string): number {
  return columns.findIndex(c => c.statusIds.includes(statusId))
}

function columnNameForStatus(columns: BoardColumn[], statusId: string): string {
  return columns.find(c => c.statusIds.includes(statusId))?.name ?? 'Unknown'
}

export async function computeSquadScrumStats(projectKey: string): Promise<SquadScrumStats> {
  const boardId = BOARD_IDS[projectKey]
  if (!boardId) throw new Error(`No board configured for squad ${projectKey}`)

  const [columns, tickets] = await Promise.all([
    fetchBoardColumns(boardId),
    fetchInFlightTickets(projectKey),
  ])

  const devColumnIndex = columns.findIndex(c => c.statusIds.includes(DEV_STATUS_ID))
  const now = Date.now()

  // columnName -> all completed day-durations tickets have spent in it
  const durationsByColumn = new Map<string, number[]>()
  let sentBackToDevCount = 0
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

      const fromIdx = columnIndexForStatus(columns, cursorStatusId)
      if (devColumnIndex >= 0 && t.toId === DEV_STATUS_ID && fromIdx > devColumnIndex) {
        sentBackToDevCount++
      }

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

  const statusDurations: StatusDuration[] = columns
    .map(col => {
      const durations = durationsByColumn.get(col.name)
      if (!durations || durations.length === 0) return null
      const avgDays = durations.reduce((sum, d) => sum + d, 0) / durations.length
      return { columnName: col.name, avgDays, ticketCount: durations.length }
    })
    .filter((d): d is StatusDuration => d !== null)

  staleTickets.sort((a, b) => b.daysStuck - a.daysStuck)

  return {
    inFlightCount: tickets.length,
    statusDurations,
    sentBackToDevCount,
    staleTickets,
  }
}

export async function computeAllScrumStats(): Promise<Record<string, SquadScrumStats>> {
  const squadKeys = Object.keys(BOARD_IDS)
  const results = await Promise.all(squadKeys.map(key => computeSquadScrumStats(key)))
  return Object.fromEntries(squadKeys.map((key, i) => [key, results[i]]))
}
