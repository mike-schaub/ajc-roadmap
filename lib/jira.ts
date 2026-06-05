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
    duedate: string | null
    labels: string[]
    priority: { name: string } | null
    description: { content: unknown[] } | null
  }
}

export async function fetchEpics(): Promise<JiraEpic[]> {
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN

  if (!email || !token) {
    throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set in .env.local')
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const jql = 'project in (CORE, EPS, MPS, MA) AND issuetype = Epic ORDER BY project ASC, created DESC'
  const fields = 'summary,status,assignee,fixVersions,duedate,labels,priority'

  const url = `${JIRA_BASE}/search/jql`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jql, fields: fields.split(','), maxResults: 100 }),
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  return (data.issues || []).map((issue: JiraEpic & { self: string }) => ({
    ...issue,
    webUrl: `https://ajc.atlassian.net/browse/${issue.key}`,
  }))
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

export function statusClass(categoryKey: string): 'todo' | 'inprog' | 'done' {
  const k = categoryKey.toLowerCase()
  if (k === 'done') return 'done'
  if (k === 'indeterminate') return 'inprog'
  return 'todo'
}
