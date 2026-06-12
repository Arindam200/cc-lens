import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { teamDir } from '@/lib/team-reader'
import { redactSessions } from '@/lib/redact'
import type { TeamExportPayload, SessionMeta } from '@/types/claude'

export const dynamic = 'force-dynamic'

// Hub mode: members POST their team export here instead of copying files into
// a shared folder by hand. The receiving instance writes into the same team
// dir the /team page reads, so push and file-drop coexist.
//
// Auth: pushes must carry CC_LENS_TEAM_TOKEN as a bearer token. The endpoint
// fails closed — if no token is configured, pushes are rejected unless
// CC_LENS_TEAM_INSECURE_LOCAL=1 explicitly opts into tokenless mode (only
// sensible on localhost or a trusted LAN/VPN).

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'member'
}

function isValidPayload(obj: unknown): obj is TeamExportPayload {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  const member = o.member as Record<string, unknown> | undefined
  return (
    o.kind === 'cclens-team-export' &&
    typeof member?.name === 'string' &&
    (member.name as string).trim().length > 0 &&
    Array.isArray(o.sessions)
  )
}

export async function POST(req: Request) {
  const token = process.env.CC_LENS_TEAM_TOKEN
  const insecureLocal = ['1', 'true'].includes(process.env.CC_LENS_TEAM_INSECURE_LOCAL ?? '')
  if (token) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: 'invalid or missing token' }, { status: 401 })
    }
  } else if (!insecureLocal) {
    return NextResponse.json(
      { error: 'push disabled: set CC_LENS_TEAM_TOKEN on the hub (or CC_LENS_TEAM_INSECURE_LOCAL=1 for tokenless local use)' },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: 'not a cclens-team-export payload' }, { status: 400 })
  }
  if (body.sessions.length > 100_000) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 })
  }

  // Defense in depth: re-run the allowlist redaction on the hub side so a
  // hand-crafted payload can't smuggle extra fields into the team store.
  const redaction = body.redaction === 'titles' ? 'titles' : 'metrics'
  const payload: TeamExportPayload = {
    kind: 'cclens-team-export',
    version: typeof body.version === 'string' ? body.version : '1.0.0',
    exportedAt: new Date().toISOString(),
    member: {
      name: body.member.name.trim(),
      ...(typeof body.member.email === 'string' && body.member.email.trim()
        ? { email: body.member.email.trim() }
        : {}),
      ...(typeof body.member.machine === 'string' && body.member.machine.trim()
        ? { machine: body.member.machine.trim() }
        : {}),
    },
    redaction,
    cc_versions: Array.isArray(body.cc_versions)
      ? body.cc_versions.filter((v): v is string => typeof v === 'string').slice(0, 50)
      : [],
    sessions: redactSessions(body.sessions as SessionMeta[], redaction),
  }

  const dir = teamDir()
  await fs.mkdir(dir, { recursive: true })
  const file = `${slugify(payload.member.name)}${payload.member.machine ? `--${slugify(payload.member.machine)}` : ''}.json`
  await fs.writeFile(path.join(dir, file), JSON.stringify(payload, null, 2))

  return NextResponse.json({
    ok: true,
    member: payload.member.name,
    sessions: payload.sessions.length,
    stored_as: file,
  })
}
