# Team Workspace Plan

Direction for turning CC Lens from a personal dashboard into a management
workspace for teams using Claude Code. This is deliberately deferred; the
single-user improvements (live sessions, workspace page, AI titles, sidechain
visualization) ship first and become the building blocks here.

## Why this wedge

Anthropic already ships team analytics for Claude for Teams / Enterprise and
Console API customers (adoption curves, PR attribution, accept rates,
leaderboards, per-user spend). Competing head-on with that is a losing game.
What they do not cover:

1. **Pro / Max plans get nothing.** Individual-plan teams (most startups and
   OSS teams) have zero team visibility. That is the underserved audience.
2. **No mission control.** Nobody shows "5 agents running across 3 repos right
   now, one idle for an hour, a routine failing."
3. **No config governance.** Teams share CLAUDE.md, skills, hooks, rules, and
   MCP config via git and it drifts constantly across machines.
4. **Aggregate-only metrics.** Anthropic gives counts; CC Lens has full session
   replays, compaction events, tool errors, and cost-per-session depth.
5. **Privacy.** CC Lens stays local-first. The team layer must keep that ethos:
   self-hosted, opt-in, additive.

## Product pillars

### 1. Mission control (team-wide live view)
- Extend the existing `/api/live` panel (reads `~/.claude/sessions/*.json`)
  across team members: who has agents running, where, on which branches.
- Surface stuck/idle agents (status `idle` with old `updatedAt`).
- Later: scheduled routines and desktop tasks status.

### 2. Config and knowledge governance
- The Workspace page already inventories skills, plugins, agents, commands,
  rules, output styles, and hooks for one machine.
- Team layer: diff each member's effective config against a "blessed" team set
  (a git repo of skills/rules/CLAUDE.md). Show drift, missing plugins, version
  skew of plugins and Claude Code itself.
- Promote flow: personal skill → shared team skill (PR into the blessed repo).

### 3. Team analytics (session-depth, any plan)
- Aggregate the per-member exports: cost per project/person/model, cache
  efficiency, compaction frequency, tool error hotspots, subagent usage.
- "Why did this session cost $4" drill-down — something the official
  dashboards cannot answer.

### 4. Privacy-first sync
- The wire format is the redacted `.cclens-team.json` member export produced
  by `/api/export/team` (shipped in v1).
- A small self-hosted hub (single binary / docker) that members push exports
  to; merge is additive-only (the import flow already computes diffs and never
  writes to `~/.claude/`).
- Alternative zero-infra mode: a shared git repo of exports; CC Lens reads the
  directory and renders the team view.
- Redaction pass before upload: strip prompts/transcripts by default, keep
  numeric aggregates; opt-in levels (metrics-only → titles → full replay).

## Architecture sketch

```text
member machine                       team hub (self-hosted)
┌──────────────────┐    push (opt-in)  ┌─────────────────────┐
│ CC Lens (local)  │ ───────────────▶ │ merge store (jsonl)  │
│ ~/.claude reader │                   │ additive only        │
│ exporter+redactor│ ◀─────────────── │ team API             │
└──────────────────┘    team view      └─────────────────────┘
```

- Hub holds only what members chose to export; no credentials, no transcripts
  unless explicitly enabled.
- Identity: per-member name/email in export metadata; no auth v1 (LAN/VPN),
  token auth v2.

## Data still untapped (feeds future features)

- `file-history/<session>/` — real lines-changed and files-touched per session
  (code churn metrics, rewind points in replay).
- `permission-mode` / `mode` JSONL lines — plan-mode usage analytics.
- `security/security_warnings_state_*.json` — safety signals per session.
- `history.jsonl` slash-command frequency — which skills earn their keep.
- `plugins/marketplaces` — where plugins come from, update staleness.

## Sequencing

1. **v1 (zero-infra team view) — shipped:** redacted `.cclens-team.json`
   member exports (`/api/export/team`, allowlist redaction in `lib/redact.ts`),
   shared-folder aggregation (`lib/team-reader.ts`, `CC_LENS_TEAM_DIR`), and a
   `/team` dashboard (cost by member, member table, version skew). See
   `TEAM.md` for usage.
2. **v2 (hub):** small self-hosted server with push endpoint + merge store;
   CC Lens gains a "team mode" toggle pointing at the hub URL.
3. **v3 (governance):** blessed-config repo diffing, drift alerts, promote
   flow, Claude Code version skew dashboard.
4. **v4 (live):** members run a tiny reporter that pushes `sessions/*.json`
   heartbeats for the team mission control board.

## Enterprise ingestion: OpenTelemetry

Claude Code natively exports OTel metrics and events
(`CLAUDE_CODE_ENABLE_TELEMETRY=1`): session counts, cost, tokens by type,
lines of code, commits, PRs, tool permission decisions, and active time —
tagged with `user.email`, `user.account_uuid`, `organization.id`,
`session.id`, `terminal.type`, plus custom `OTEL_RESOURCE_ATTRIBUTES` like
`team.id` or `department`. Administrators can enforce this org-wide through
the managed settings file, which means complete, real-time coverage with no
manual exports.

This reframes the hub (v2): rather than only accepting pushed export files,
the hub should also be an OTLP receiver. Open-core split:

- **OSS (always free):** local dashboard, redacted exports, shared-folder
  team view — everything that reads files.
- **Paid hub (self-hosted license or managed):** OTLP ingestion, retention,
  member management, governance/drift (v3), live mission control (v4),
  SSO/audit. Sales motion: teams outgrow the shared folder when they want
  real-time data, enforcement, and >10 members.

OTel gives aggregate metrics only (no session replay depth) — the JSONL
exports stay valuable as the deep-dive layer on top of OTel's complete
real-time coverage. The two sources join on `session.id`.

## Open questions

- Pricing/packaging: OSS core + paid hub? Hosted option contradicts the
  privacy story unless E2E-encrypted.
- Identity for PR attribution without the GitHub app (map git author email to
  member exports?).
- How much session content can be shared by default without making security
  teams nervous — start with metrics-only and let teams loosen it.
