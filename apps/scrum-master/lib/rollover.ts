// Jira's Sprint field (customfield_10115) lists every sprint a ticket has been in. Closed ones are sprints
// the ticket was still sitting in when they ended, i.e. each one is a rollover.
export const SPRINT_FIELD = 'customfield_10115'

export interface JiraSprintRef {
  name: string
  state?: string
  startDate?: string
}

// Names of the sprints a ticket rolled over from, oldest first.
export function rolledOverFrom(sprints: JiraSprintRef[] | null | undefined): string[] {
  return (sprints ?? [])
    .filter(s => s.state === undefined || s.state === 'closed')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    .map(s => s.name)
}
