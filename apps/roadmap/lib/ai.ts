import Anthropic from '@anthropic-ai/sdk'
import type { JiraEpic, JiraStory } from './jira'
import { statusClass, adfToText } from './jira'

const STUCK_DAYS = 10

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// One batched call per page render — one sentence per epic answering
// "what's the status of this project, and why?"
export async function summarizeEpicStatus(
  grouped: Record<string, JiraEpic[]>,
  storiesByEpic: Record<string, JiraStory[]>
): Promise<Record<string, string | null>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return {}

  const candidates = Object.values(grouped)
    .flat()
    .map(epic => {
      const stories = storiesByEpic[epic.key] ?? []
      return {
        key: epic.key,
        title: epic.fields.summary,
        status: epic.fields.status.name,
        stories: stories.map(s => ({
          status: s.fields.status.name,
          stuck: statusClass(s.fields.status.statusCategory.key) === 'inprog' && daysSince(s.fields.updated) >= STUCK_DAYS,
          recentComments: (s.fields.comment?.comments ?? [])
            .slice(-3)
            .map(c => adfToText(c.body).trim())
            .filter(t => t.length > 10),
        })),
      }
    })
    .filter(e => e.stories.length > 0)

  if (candidates.length === 0) return {}

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a status reporter for a product roadmap dashboard. For each epic below, answer in ONE sentence (under 20 words): what's the status of this project, and why?

Lead with a short status word or phrase (e.g. On track, At risk, Blocked, Stalled), then the reason. Base the reason on story comments when they mention blockers, risks, decisions, or progress — otherwise infer it from the story status mix (e.g. most stories done, one stuck in review for weeks, no active work).

Respond ONLY with valid JSON: {"EPIC-KEY": "status sentence", ...}. Omit an epic's key entirely if there is truly nothing meaningful to say about it (don't include it with a null value).

Epics:
${JSON.stringify(candidates, null, 2)}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0])
  } catch {
    return {}
  }
}
