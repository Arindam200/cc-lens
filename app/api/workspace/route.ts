import { NextResponse } from 'next/server'
import {
  readSkills,
  readInstalledPlugins,
  readConfigDir,
  readSettings,
} from '@/lib/claude-reader'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [skills, plugins, agents, commands, rules, outputStyles, workflows, settings] =
    await Promise.all([
      readSkills(),
      readInstalledPlugins(),
      readConfigDir('agents'),
      readConfigDir('commands'),
      readConfigDir('rules'),
      readConfigDir('output-styles'),
      readConfigDir('workflows'),
      readSettings(),
    ])

  // Hook config lives in settings.json as { event: [{ matcher, hooks: [...] }] }.
  // settings.json is user-edited, so tolerate any shape and skip invalid events.
  const hooksValue = settings.hooks
  const hooksRaw =
    hooksValue && typeof hooksValue === 'object' && !Array.isArray(hooksValue)
      ? (hooksValue as Record<string, unknown>)
      : undefined
  const hooks = hooksRaw
    ? Object.entries(hooksRaw).flatMap(([event, matchers]) => {
        if (!Array.isArray(matchers)) return []
        return [{
          event,
          matchers: matchers.length,
          commands: matchers.reduce(
            (sum: number, m) => sum + (Array.isArray(m?.hooks) ? m.hooks.length : 0),
            0
          ),
        }]
      })
    : []

  return NextResponse.json({
    skills,
    plugins,
    agents,
    commands,
    rules,
    outputStyles,
    workflows,
    hooks,
  })
}
