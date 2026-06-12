# Team Mode

Team mode aggregates Claude Code usage across multiple people with zero
infrastructure: no server, no accounts, no agents to install. Each member
exports a redacted metrics file; the team lead points cc-lens at a folder of
those files.

## How it works

```text
member machine                shared folder                       team lead machine
┌────────────────┐          ┌────────────────────────┐          ┌────────────────┐
│ cc-lens        │ download │ alice.cclens-team.json │  read    │ cc-lens /team  │
│ /export page   │ ───────▶ │ bob.cclens-team.json   │ ◀─────── │ CC_LENS_TEAM_  │
│ (redacted)     │          │ carol.cclens-team.json │          │ DIR=...        │
└────────────────┘          └────────────────────────┘          └────────────────┘
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

## Hub mode: push instead of copying files

Any running cc-lens instance doubles as a team hub. Run it where the team can
reach it (an office box, a small VM, behind your VPN):

```bash
# On the hub — pushes are rejected unless a token is set
CC_LENS_TEAM_TOKEN=<shared-secret> HOSTNAME=0.0.0.0 npx cc-lens
```

The push endpoint fails closed: without `CC_LENS_TEAM_TOKEN` it returns 401.
For tokenless experiments on localhost or a trusted LAN, opt in explicitly
with `CC_LENS_TEAM_INSECURE_LOCAL=1`.

Members push directly from their machines, no UI needed:

```bash
npx cc-lens push --to http://hub.internal:3000 --name "Alice" --token <shared-secret>
```

`push` builds the same redacted export locally and POSTs it to
`/api/team/push` on the hub. The hub re-runs the redaction allowlist on
whatever it receives before storing, validates the payload, and writes one
file per member+machine into its team dir. Add `--titles` to include first
prompts, `--machine laptop` to distinguish machines, `--email` for commit
attribution.

Automate freshness with cron:

```bash
0 18 * * 1-5  npx cc-lens push --to http://hub.internal:3000 --name "Alice" --token $CC_LENS_TEAM_TOKEN
```

## What the team sees

- Total team cost, sessions, messages, and cache savings
- Cost over time, stacked by member
- Per-member table: sessions, cost, tokens, cache hit rate, active time,
  top project, last active (members inactive 14+ days are badged idle)
- Feature adoption per member — plan mode, agents, skills, MCP, web — with
  cost per session, for coaching rollout rather than policing it
- MCP server inventory: every server seen in team sessions, its call volume,
  and who uses it — review anything you don't recognize
- Claude Code version skew — who is running an outdated CLI

## Digest

Any member can print a formatted team summary in the terminal:

```bash
npx cc-lens digest --team --days 7
```

The digest covers spend vs the prior period, top members, and session
counts. Run it without `--team` for a personal digest with budget pace,
potential savings, and spend-spike alerts.

Slack and webhook alerts are not part of the open-source package; they are
planned for the managed version.

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
