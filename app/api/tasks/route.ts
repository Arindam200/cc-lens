import { NextResponse } from 'next/server'
import path from 'path'
import {
  readTaskSessions,
  listProjectSlugs,
  listProjectJSONLFiles,
} from '@/lib/claude-reader'
import { slugToPath } from '@/lib/decode'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [sessions, slugs] = await Promise.all([readTaskSessions(), listProjectSlugs()])

  // Session ids match JSONL basenames under ~/.claude/projects/<slug>/, so a
  // directory listing is enough to attribute each task session to a project.
  const projectBySession = new Map<string, string>()
  await Promise.all(
    slugs.map(async (slug) => {
      const files = await listProjectJSONLFiles(slug)
      for (const f of files) projectBySession.set(path.basename(f, '.jsonl'), slug)
    })
  )

  return NextResponse.json({
    sessions: sessions.map((s) => {
      const slug = projectBySession.get(s.sessionId)
      // Allowlist fields so server filesystem paths never reach the client
      return {
        sessionId: s.sessionId,
        tasks: s.tasks,
        mtime: s.mtime,
        project: slug ? slugToPath(slug) : null,
      }
    }),
  })
}
