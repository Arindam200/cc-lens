// Parse user-turn text from Claude Code JSONL. Beyond plain messages, these turns
// can carry local-command metadata (slash commands, their stdout, caveats) wrapped
// in pseudo-XML tags, sometimes with ANSI color codes. We surface them gracefully.

// Matches CSI SGR sequences (ESC[1m, ESC[22m, …) used for terminal colors.
// Built from the ESC char code to keep a control byte out of the source.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')

export function stripAnsi(s: string): string {
  return s.replace(ANSI, '')
}

export type ParsedUserMessage =
  | { kind: 'slash_command'; name: string; args?: string }
  | { kind: 'command_output'; text: string }
  | { kind: 'caveat' }
  | { kind: 'text'; text: string }

function tag(s: string, name: string): string | undefined {
  const m = s.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1] : undefined
}

export function parseUserMessage(raw: string): ParsedUserMessage {
  const s = raw.trim()

  const name = tag(s, 'command-name')
  if (name != null) {
    const args = tag(s, 'command-args')?.trim()
    return { kind: 'slash_command', name: name.trim(), args: args || undefined }
  }

  const stdout = tag(s, 'local-command-stdout')
  if (stdout != null) {
    return { kind: 'command_output', text: stripAnsi(stdout).trim() }
  }

  if (s.startsWith('<local-command-caveat>')) {
    return { kind: 'caveat' }
  }

  return { kind: 'text', text: stripAnsi(s) }
}
