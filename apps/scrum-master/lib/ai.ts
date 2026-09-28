import Anthropic from '@anthropic-ai/sdk'
import type { JiraStory } from './jira'
import { statusClass, adfToText } from './jira'

// One batched call per page render — evaluates all non-done stories with comments.
// Returns a flat map of story key → one-sentence status note, or null if not relevant.
export async function summarizeStoryComments(
  storiesByEpic: Record<string, JiraStory[]>
): Promise<Record<string, string | null>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return {}

  // Only include non-done stories that actually have comments
  const candidates = Object.values(storiesByEpic)
    .flat()
    .filter(s => statusClass(s.fields.status.statusCategory.key) !== 'done')
    .map(s => ({
      key: s.key,
      title: s.fields.summary,
      status: s.fields.status.name,
      comments: (s.fields.comment?.comments ?? [])
        .slice(-3) // last 3 comments per story
        .map(c => ({ author: c.author.displayName, text: adfToText(c.body).trim() }))
        .filter(c => c.text.length > 10),
    }))
    .filter(s => s.comments.length > 0)

  if (candidates.length === 0) return {}

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are reviewing Jira story comments for a product roadmap dashboard. For each story, determine whether the comments contain information relevant to project status — blockers, risks, important decisions, dependencies, or meaningful progress updates.

If relevant, write ONE concise sentence (under 15 words) capturing the key status information.
If not relevant (routine acknowledgments, admin notes, vague check-ins, questions without answers), return null.

Respond ONLY with valid JSON: {"STORY-KEY": "summary or null", ...}

Stories:
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
