# Team Mode

Team mode aggregates Claude Code usage across multiple people with zero
infrastructure: no server, no accounts, no agents to install. Each member
exports a redacted metrics file; the team lead points cc-lens at a folder of
those files.

## How it works

```
member machine                shared folder                 team lead machine
┌────────────────┐            ┌──────────────────┐          ┌────────────────┐
│ cc-lens        │  download  │ alice-2026.json  │  read    │ cc-lens /team  │
│ /export page   │ ─────────▶ │ bob-2026.json    │ ◀─────── │ CC_LENS_TEAM_  │
│ (redacted)     │            │ carol-2026.json  │          │ DIR=...        │
└────────────────┘            └──────────────────┘          └────────────────┘
```

1. **Each member** opens the Export page and downloads a
   `.cclens-team.json` with their name attached.
2. **Everyone drops their file** into one shared folder — a git repo, a
   Drive/Dropbox folder, or a network share. Anything that syncs files works.
3. **Anyone** runs cc-lens pointed at that folder and opens `/team`:

   ```bash
   CC_LENS_TEAM_DIR=/path/to/team-exports npx cc-lens
   ```

   Without `CC_LENS_TEAM_DIR`, cc-lens watches `~/.cc-lens/team/`.

Re-exporting is additive: the newest export per member (and per machine, if
the member sets a machine label) wins, so stale files in the folder are
harmless.

## What the team sees

- Total team cost, sessions, messages, and cache savings
- Cost over time, stacked by member
- Per-member table: sessions, cost, tokens, cache hit rate, active time,
  top project, last active
- Claude Code version skew — who is running an outdated CLI

## What leaves each member's machine

Team exports are redacted by default (`metrics` level):

| Data | Included? |
| --- | --- |
| Token counts, costs, durations, tool counts | Yes |
| Session start/end times (day + hour granularity) | Yes |
| Project folder name (`payments-api`) | Yes |
| Full project path (`/Users/alice/...`) | No — collapsed to folder name |
| Prompts and conversation content | No |
| First prompt per session ("session title") | Only with the opt-in `titles` level |
| Per-message timestamps and response-time series | No |
| Command history, todos, plans, memory | Never exported |

The export is a plain JSON file — members can (and should) inspect it before
sharing. The redaction is an allowlist: fields not explicitly listed in
`lib/redact.ts` never make it into an export.

## Data completeness and its limits

The source of truth is each member's local `~/.claude/projects/**/*.jsonl`.
An export contains every session recorded there at export time. Known gaps:

- **Manual cadence.** Data is as fresh as the last export. Teams typically
  re-export weekly; a CI job or cron that hits
  `POST /api/export/team` on each member's machine can automate it.
- **Cloud sessions.** Sessions run on claude.ai/code or Anthropic-managed
  routines don't write to a local `~/.claude` unless teleported into the CLI.
- **Multiple machines.** Use the machine label so one person's laptop and
  desktop both count, deduped per machine rather than overwriting each other.

For guaranteed-complete, real-time team data, Claude Code ships native
OpenTelemetry support (`CLAUDE_CODE_ENABLE_TELEMETRY=1`) that administrators
can enforce org-wide through the managed settings file. It exports cost,
token, lines-of-code, commit, and PR metrics tagged with `user.email`,
`organization.id`, and `session.id` to any OTLP endpoint. That is the
ingestion path the planned hub/enterprise edition builds on — see
`TEAM-WORKSPACE-PLAN.md` for sequencing.
