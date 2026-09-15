const JIRA_BASE = 'https://ajc.atlassian.net/rest/api/3'

export interface JiraEpic {
  id: string
  key: string
  webUrl: string
  fields: {
    summary: string
    status: {
      name: string
      statusCategory: { key: string }
    }
    assignee: { displayName: string; avatarUrls: { '24x24': string } } | null
    fixVersions: { name: string }[]
    startdate: string | null
    duedate: string | null
    labels: string[]
    priority: { name: string } | null
    description: { content: unknown[] } | null
  }
}

async function jiraEpicQuery(auth: string, jql: string): Promise<JiraEpic[]> {
  const fields = 'summary,status,assignee,fixVersions,startdate,duedate,labels,priority'
  const res = await fetch(`${JIRA_BASE}/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jql, fields: fields.split(','), maxResults: 100 }),
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return (data.issues || []).map((issue: JiraEpic & { self: string }) => ({
    ...issue,
    webUrl: `https://ajc.atlassian.net/browse/${issue.key}`,
  }))
}

export async function fetchEpics(): Promise<JiraEpic[]> {
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN

  if (!email || !token) {
    throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set in .env.local')
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64')

  // Jira hard-caps results at 100. Fetch MPS separately so it doesn't get
  // crowded out by CORE + EPS + MA which alone fill the limit.
  const [main, mps] = await Promise.all([
    jiraEpicQuery(auth, 'project in (CORE, EPS, MA) AND issuetype = Epic ORDER BY project ASC, created DESC'),
    jiraEpicQuery(auth, 'project = MPS AND issuetype = Epic ORDER BY created DESC'),
  ])

  return [...main, ...mps]
}

export function groupByProject(epics: JiraEpic[]): Record<string, JiraEpic[]> {
  const groups: Record<string, JiraEpic[]> = {
    CORE: [],
    EPS: [],
    MPS: [],
    MA: [],
  }
  for (const epic of epics) {
    const key = epic.key.split('-')[0]
    if (key in groups) groups[key].push(epic)
  }
  return groups
}

export interface JiraBug {
  id: string
  key: string
  webUrl: string
  fields: {
    summary: string
    status: {
      name: string
      statusCategory: { key: string }
    }
    assignee: { displayName: string; avatarUrls: { '24x24': string } } | null
    fixVersions: { name: string; released: boolean }[]
    priority: { name: string } | null
    updated: string
  }
}

async function jiraBugQuery(auth: string, jql: string): Promise<JiraBug[]> {
  const fields = 'summary,status,assignee,fixVersions,priority,updated'
  const res = await fetch(`${JIRA_BASE}/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jql, fields: fields.split(','), maxResults: 100 }),
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return (data.issues || []).map((issue: JiraBug & { self: string }) => ({
    ...issue,
    webUrl: `https://ajc.atlassian.net/browse/${issue.key}`,
  }))
}

export async function fetchBugs(): Promise<JiraBug[]> {
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN
  if (!email || !token) {
    throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set in .env.local')
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64')

  // Pull open bugs plus any Done bug still tagged to an unreleased version —
  // once that version ships, the JS filter below drops it from the board.
  // Jira hard-caps results at 100 per query. CORE + EPS alone have ~100 matching
  // bugs, which would crowd MPS/MA out of a single shared query — so fetch each
  // project separately (same issue fetchEpics works around for MPS).
  const projects = ['CORE', 'EPS', 'MPS', 'MA']
  const perProject = await Promise.all(
    projects.map(project =>
      jiraBugQuery(
        auth,
        `project = ${project} AND issuetype = Bug AND (statusCategory != Done OR fixVersion is not EMPTY) ORDER BY priority DESC, updated DESC`
      )
    )
  )
  const bugs = perProject.flat()

  return bugs.filter(bug => {
    if (statusClass(bug.fields.status.statusCategory.key) !== 'done') return true
    return bug.fields.fixVersions.some(v => !v.released)
  })
}

export function groupBugsByProject(bugs: JiraBug[]): Record<string, JiraBug[]> {
  const groups: Record<string, JiraBug[]> = {
    CORE: [],
    EPS: [],
    MPS: [],
    MA: [],
  }
  for (const bug of bugs) {
    const key = bug.key.split('-')[0]
    if (key in groups) groups[key].push(bug)
  }
  return groups
}

export function statusClass(categoryKey: string): 'todo' | 'inprog' | 'done' {
  const k = categoryKey.toLowerCase()
  if (k === 'done') return 'done'
  if (k === 'indeterminate') return 'inprog'
  return 'todo'
}

export interface JiraComment {
  id: string
  author: { displayName: string }
  body: unknown
  created: string
}

export interface JiraStory {
  id: string
  key: string
  webUrl: string
  fields: {
    summary: string
    status: {
      name: string
      statusCategory: { key: string }
    }
    assignee: { displayName: string } | null
    updated: string
    comment: { comments: JiraComment[]; total: number } | null
  }
}

export async function fetchEpicChildren(epicKey: string): Promise<JiraStory[]> {
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN
  if (!email || !token) throw new Error('Missing Jira credentials')

  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  // Try parent= (next-gen) first; classic projects use "Epic Link" custom field
  const jql = `parent = ${epicKey} ORDER BY created ASC`

  const res = await fetch(`${JIRA_BASE}/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql,
      fields: ['summary', 'status', 'assignee', 'updated', 'comment'],
      maxResults: 50,
    }),
    next: { revalidate: 300 },
  })

  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.issues || []).map((issue: JiraStory & { self: string }) => ({
    ...issue,
    webUrl: `https://ajc.atlassian.net/browse/${issue.key}`,
  }))
}

// Extracts plain text from Atlassian Document Format (ADF)
export function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === 'text') return n.text ?? ''
  if (Array.isArray(n.content)) return n.content.map(adfToText).filter(Boolean).join(' ')
  return ''
}
