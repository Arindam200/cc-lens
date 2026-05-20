'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { formatTokens, formatRelativeDate, projectDisplayName } from '@/lib/decode'
import type { SessionWithFacet } from '@/types/claude'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type FilterType = 'active' | 'recent' | 'all'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * ONE_DAY_MS

interface Props {
  sessions: SessionWithFacet[]
}

function shortId(id: string): string {
  return id.slice(0, 8) + '…'
}

export function OverviewConversationTable({ sessions }: Props) {
  const [filter, setFilter] = useState<FilterType>('recent')
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setNow(Date.now())
    const initial = window.setTimeout(update, 0)
    const interval = window.setInterval(update, 60_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [])

  const filtered = useMemo(() => {
    const lastActiveMs = (s: SessionWithFacet) =>
      new Date(s.last_activity ?? s.start_time).getTime()

    let result: SessionWithFacet[]
    switch (filter) {
      case 'active':
        result = now === null
          ? sessions
          : sessions.filter(s => now - lastActiveMs(s) < ONE_DAY_MS)
        break
      case 'recent':
        result = now === null
          ? sessions
          : sessions.filter(s => now - lastActiveMs(s) < ONE_WEEK_MS)
        break
      default:
        result = sessions
    }
    return result.sort((a, b) => lastActiveMs(b) - lastActiveMs(a))
  }, [sessions, filter, now])

  const displaySessions = filtered.slice(0, 10)

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={v => setFilter(v as FilterType)}>
        <TabsList>
          <TabsTrigger value="active">Active (24h)</TabsTrigger>
          <TabsTrigger value="recent">Recent (7d)</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Session</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Project</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Messages</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Tokens</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Last Active</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displaySessions.map(s => {
            const totalMsgs = (s.user_message_count ?? 0) + (s.assistant_message_count ?? 0)
            const totalTokens = (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
            const projectName = projectDisplayName(s.project_path ?? '')
            const lastActive = s.last_activity ?? s.start_time
            const isActive = now !== null && now - new Date(lastActive).getTime() < ONE_DAY_MS

            return (
              <TableRow key={s.session_id}>
                <TableCell className="font-mono text-muted-foreground">
                  <Link
                    href={`/sessions/${s.session_id}`}
                    className="hover:text-primary transition-colors"
                    title={s.session_id}
                  >
                    {shortId(s.session_id)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/sessions/${s.session_id}`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {projectName}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {totalMsgs.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-primary">
                  {formatTokens(totalTokens)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatRelativeDate(lastActive)}
                </TableCell>
                <TableCell>
                  {isActive ? (
                    <Badge variant="outline" className="text-[#34d399] border-[#34d399]/30 bg-[#34d399]/10 gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] inline-block" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Completed</Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
          {displaySessions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No sessions match this filter
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
