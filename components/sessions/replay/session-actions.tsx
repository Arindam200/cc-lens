'use client'

import { Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { replayToMarkdown, replayMarkdownFilename } from '@/lib/replay-markdown'
import type { ReplayData } from '@/types/claude'

export function SessionActions({ replay }: { replay: ReplayData }) {
  const { toast } = useToast()

  async function copyResumeCommand() {
    const command = `claude --resume ${replay.session_id}`
    try {
      await navigator.clipboard.writeText(command)
      toast({ title: 'Copied', description: command })
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard access was denied.', variant: 'error' })
    }
  }

  function exportMarkdown() {
    const blob = new Blob([replayToMarkdown(replay)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = replayMarkdownFilename(replay)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={copyResumeCommand} className="gap-1.5">
        <Copy className="h-3.5 w-3.5" />
        Copy resume command
      </Button>
      <Button variant="outline" size="sm" onClick={exportMarkdown} className="gap-1.5">
        <Download className="h-3.5 w-3.5" />
        Export as Markdown
      </Button>
    </div>
  )
}
