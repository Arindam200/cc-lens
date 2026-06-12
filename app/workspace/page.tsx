'use client'

import useSWR from 'swr'
import { TopBar } from '@/components/layout/top-bar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sparkles, Puzzle, Bot, TerminalSquare, BookOpenText,
  Paintbrush, Workflow, Webhook, AlertTriangle,
} from 'lucide-react'
import type { SkillInfo, PluginInfo, ConfigFileInfo } from '@/lib/claude-reader'

const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })

interface WorkspaceData {
  skills: SkillInfo[]
  plugins: PluginInfo[]
  agents: ConfigFileInfo[]
  commands: ConfigFileInfo[]
  rules: ConfigFileInfo[]
  outputStyles: ConfigFileInfo[]
  workflows: ConfigFileInfo[]
  hooks: Array<{ event: string; matchers: number; commands: number }>
}

function CountCard({
  title, count, description, icon: Icon,
}: {
  title: string; count: number; description: string; icon: React.ElementType
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" /> {title}
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">{count}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function ConfigList({ items, emptyHint }: { items: ConfigFileInfo[]; emptyHint: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyHint}</p>
  }
  return (
    <div className="grid gap-2">
      {items.map(item => (
        <div key={item.name} className="border border-border rounded-lg p-3">
          <p className="text-primary font-mono text-sm font-bold">{item.name}</p>
          {item.description && (
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export default function WorkspacePage() {
  const { data, error, isLoading } = useSWR<WorkspaceData>('/api/workspace', fetcher, {
    refreshInterval: 30_000,
  })

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Workspace" subtitle="Error" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading workspace: {String(error)}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Workspace" subtitle="Loading…" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Workspace"
        subtitle="Your Claude Code customization surface — ~/.claude/"
      />
      <div className="p-4 md:p-6 space-y-6">

        {/* Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <CountCard title="Skills" count={data.skills.length} description="Reusable /slash workflows" icon={Sparkles} />
          <CountCard title="Plugins" count={data.plugins.length} description="Installed from marketplaces" icon={Puzzle} />
          <CountCard title="Agents" count={data.agents.length} description="Custom subagents" icon={Bot} />
          <CountCard title="Commands" count={data.commands.length} description="Single-file commands" icon={TerminalSquare} />
        </div>

        {/* Plugins */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Installed Plugins</CardTitle>
                <CardDescription>From ~/.claude/plugins — version, marketplace, and scope</CardDescription>
              </div>
              <Puzzle className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            {data.plugins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No plugins installed. Browse marketplaces with /plugin in Claude Code.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.plugins.map(plugin => (
                  <div key={plugin.id + plugin.scope} className="border border-border rounded-lg p-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-primary font-mono text-sm font-bold truncate" title={plugin.id}>{plugin.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5 truncate">
                        {plugin.marketplace || 'unknown marketplace'} · {plugin.scope}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="font-mono text-[11px]">v{plugin.version}</Badge>
                      <p className="text-muted-foreground text-xs mt-1">
                        {new Date(plugin.lastUpdated ?? plugin.installedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Skills ({data.skills.length})</CardTitle>
                <CardDescription>Reusable workflows in ~/.claude/skills — invoked as /name</CardDescription>
              </div>
              <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>
          </CardHeader>
          <CardContent>
            {data.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills found in ~/.claude/skills/</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.skills.map(skill => (
                  <div key={skill.name} className="border border-border rounded-lg p-3 flex items-start gap-3">
                    <span className="shrink-0 w-2 h-2 mt-1.5 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="text-primary font-mono text-sm font-bold">/{skill.name}</p>
                      {skill.description && (
                        <p className="text-foreground text-xs mt-0.5">{skill.description}</p>
                      )}
                      {skill.triggers && (
                        <p className="text-muted-foreground text-xs mt-1 leading-relaxed line-clamp-2">{skill.triggers}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agents + Commands */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Subagents ({data.agents.length})</CardTitle>
                  <CardDescription>Custom agents in ~/.claude/agents</CardDescription>
                </div>
                <Bot className="w-4 h-4 text-muted-foreground mt-0.5" />
              </div>
            </CardHeader>
            <CardContent>
              <ConfigList items={data.agents} emptyHint="No custom subagents yet. Create them with /agents in Claude Code." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Commands ({data.commands.length})</CardTitle>
                  <CardDescription>Single-file commands in ~/.claude/commands</CardDescription>
                </div>
                <TerminalSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
              </div>
            </CardHeader>
            <CardContent>
              <ConfigList items={data.commands} emptyHint="No personal commands. New workflows should be skills instead." />
            </CardContent>
          </Card>
        </div>

        {/* Rules + Output styles + Workflows + Hooks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Rules ({data.rules.length})</CardTitle>
                  <CardDescription>Topic-scoped instructions in ~/.claude/rules</CardDescription>
                </div>
                <BookOpenText className="w-4 h-4 text-muted-foreground mt-0.5" />
              </div>
            </CardHeader>
            <CardContent>
              <ConfigList items={data.rules} emptyHint="No user-level rules defined." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Hooks ({data.hooks.length})</CardTitle>
                  <CardDescription>Lifecycle hooks from ~/.claude/settings.json</CardDescription>
                </div>
                <Webhook className="w-4 h-4 text-muted-foreground mt-0.5" />
              </div>
            </CardHeader>
            <CardContent>
              {data.hooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hooks configured.</p>
              ) : (
                <div className="grid gap-2">
                  {data.hooks.map(hook => (
                    <div key={hook.event} className="border border-border rounded-lg p-3 flex items-center justify-between gap-4">
                      <p className="text-primary font-mono text-sm font-bold">{hook.event}</p>
                      <p className="text-muted-foreground text-xs">
                        {hook.matchers} matcher{hook.matchers === 1 ? '' : 's'} · {hook.commands} command{hook.commands === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {(data.outputStyles.length > 0 || data.workflows.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.outputStyles.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Output Styles ({data.outputStyles.length})</CardTitle>
                      <CardDescription>Custom system-prompt styles in ~/.claude/output-styles</CardDescription>
                    </div>
                    <Paintbrush className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ConfigList items={data.outputStyles} emptyHint="" />
                </CardContent>
              </Card>
            )}
            {data.workflows.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Workflows ({data.workflows.length})</CardTitle>
                      <CardDescription>Dynamic workflows in ~/.claude/workflows</CardDescription>
                    </div>
                    <Workflow className="w-4 h-4 text-muted-foreground mt-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <ConfigList items={data.workflows} emptyHint="" />
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
