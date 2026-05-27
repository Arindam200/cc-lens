# Compatibility

This project tracks Claude Code's local data files. Compatibility is best-effort because those files are not a stable public API.

## Supported Runtime

- Node.js 18 or newer.
- npm.
- macOS and Linux are the most-tested environments.
- Windows is supported in the CLI and docs, but needs more broad testing.

## Supported Claude Code Data

`cc-lens` currently reads:

- `~/.claude/projects/<slug>/*.jsonl`
- `~/.claude/stats-cache.json`
- `~/.claude/usage-data/session-meta/`
- `~/.claude/history.jsonl`
- `~/.claude/todos/`
- `~/.claude/plans/`
- `~/.claude/projects/*/memory/`
- `~/.claude/settings.json`

You can point `cc-lens` at another Claude Code config directory:

```bash
CLAUDE_CONFIG_DIR=~/.claude-work npx cc-lens
```

## Compatibility Policy

- Missing files should produce empty states, not crashes.
- Malformed JSONL lines should be skipped.
- New Claude Code fields should be ignored until `cc-lens` uses them.
- Old sessions should still appear when enough metadata exists to identify the session.

## Reporting Compatibility Issues

Open a bug report and include:

- `cc-lens` version
- operating system
- Node.js version
- whether you use `CLAUDE_CONFIG_DIR`
- which page is wrong or empty
- a redacted example of the affected local file shape, if safe to share

Do not paste private prompts, source code, command output, secrets, or full session transcripts into public issues.
