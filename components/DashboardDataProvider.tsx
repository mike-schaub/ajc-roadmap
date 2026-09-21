'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { JiraEpic, JiraStory, JiraBug } from '@/lib/jira'

export interface DashboardData {
  grouped: Record<string, JiraEpic[]>
  storiesByEpic: Record<string, JiraStory[]>
  commentSummaries: Record<string, string | null>
  bugsGrouped: Record<string, JiraBug[]>
  fetchedAt: string | null
  today: string
  error: string | null
}

const DashboardDataContext = createContext<DashboardData | null>(null)

export function DashboardDataProvider({
  data,
  children,
}: {
  data: DashboardData
  children: ReactNode
}) {
  return (
    <DashboardDataContext.Provider value={data}>
      {children}
    </DashboardDataContext.Provider>
  )
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error('useDashboardData must be used within DashboardDataProvider')
  return ctx
}
