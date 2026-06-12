# Roadmap

This roadmap is intentionally practical. `cc-lens` should stay local-first, fast to launch, and useful without an account or hosted backend.

## Near Term

- **Demo mode**: Add `npx cc-lens --demo` with anonymized sample data so users can evaluate the dashboard before they have Claude Code history.
- **Parser tests**: Add focused coverage for JSONL parsing, malformed lines, missing directories, old session shapes, Windows paths, and pricing estimates.
- **First-run diagnostics**: Show clear empty/error states for missing `~/.claude/`, unreadable files, empty projects, and active `CLAUDE_CONFIG_DIR`.
- **Replay search**: Search within a session replay and filter turns by tools, errors, compaction, and high-cost turns.

## Medium Term

- **Redacted export**: Let users export selected sessions with prompts, paths, and command output redacted.
- **Pricing overrides**: Allow local pricing overrides and show the pricing table date used for estimates.
- **Compatibility fixtures**: Maintain sample fixtures for known Claude Code local file formats.

## Shipped

- **Actionable insights** (`/insights`): low cache hit rate, premium models on light sessions, compaction thrash, and plan fit — each with a monthly dollar estimate.
- **Budgets and spend alerts**: monthly budget with pacing projection and daily spike detection.
- **Team adoption and MCP governance** (`/team`): per-member feature adoption, idle members, and an inventory of MCP servers in use.
- **Terminal digest** (`cc-lens digest`): formatted spend summary for solo or team scope, printed in the terminal. Slack/webhook alerts are planned for the managed version only.
- **Wrapped** (`/wrapped`): shareable yearly stats card.

## Later

- **Team aggregate mode**: Merge redacted exports from multiple machines into aggregate analytics without sharing raw transcripts.
- **Public sample dashboard**: Publish a static/sample view that demonstrates the product without private data.
- **Plugin-style metrics**: Allow advanced users to add local-only custom metrics without changing core dashboard code.

## Non-Goals

- Hosted sync by default.
- Telemetry by default.
- Uploading raw Claude Code transcripts.
- Replacing Claude Code's own files or acting as the source of truth.
