import { NextResponse } from 'next/server'
import { readSettings, getClaudeStorageBytes } from '@/lib/claude-reader'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [settings, storageBytes] = await Promise.all([
    readSettings(),
    getClaudeStorageBytes(),
  ])
  return NextResponse.json({ settings, storageBytes })
}
