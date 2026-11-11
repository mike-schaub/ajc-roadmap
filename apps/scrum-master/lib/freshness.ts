import { AsyncLocalStorage } from 'node:async_hooks'

// Jira responses are cached by Next (revalidate: 900 etc.), so "when this API route ran" says nothing about
// how old the data is. Cached responses keep Jira's original `Date` header, so we track the oldest one seen
// while serving a request and report that as "data as of".
const LIVE_MAX_REVALIDATE = 900
const store = new AsyncLocalStorage<{ oldest: number }>()

export async function withFreshness<T>(fn: () => Promise<T>): Promise<{ result: T; dataAsOf: string }> {
  const ctx = { oldest: Infinity }
  const result = await store.run(ctx, fn)
  return { result, dataAsOf: new Date(Number.isFinite(ctx.oldest) ? ctx.oldest : Date.now()).toISOString() }
}

export async function trackedFetch(input: string, init?: RequestInit & { next?: { revalidate?: number } }): Promise<Response> {
  const res = await fetch(input, init)
  const ctx = store.getStore()
  // Slow-changing data (board config, closed sprint reports) would drag the label back hours for no reason.
  if (ctx && (init?.next?.revalidate ?? 0) <= LIVE_MAX_REVALIDATE) {
    const parsed = Date.parse(res.headers.get('date') ?? '')
    ctx.oldest = Math.min(ctx.oldest, Number.isNaN(parsed) ? Date.now() : parsed)
  }
  return res
}
