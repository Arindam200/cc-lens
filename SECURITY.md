# Security Policy

Claude Code Lens reads local Claude Code files that may contain sensitive prompts, file paths, command output, tool results, and project history. Security and privacy regressions are treated as high priority.

## Supported Versions

The latest published npm version and the current `main` branch receive security fixes.

## Reporting a Vulnerability

If you find a vulnerability, please report it privately instead of opening a public issue.

- GitHub Security Advisories are preferred when available.
- If advisories are unavailable, contact the maintainer listed in `package.json`.

Please include:

- affected version or commit
- operating system
- reproduction steps
- whether private Claude Code data can be read, modified, exposed, or uploaded
- any relevant logs or screenshots with sensitive content redacted

## Security Principles

- No telemetry.
- No account system.
- No hosted backend.
- No API key requirement.
- Local Claude Code data stays on the user's machine.
- The packaged CLI binds to `127.0.0.1` by default.
- LAN access requires an explicit `HOSTNAME=0.0.0.0` opt-in.

## Local Files Read

`cc-lens` reads data from the active Claude Code config directory. By default this is `~/.claude/`; users can override it with `CLAUDE_CONFIG_DIR`.

Known reads include:

- `projects/<slug>/*.jsonl`
- `stats-cache.json`
- `usage-data/session-meta/`
- `history.jsonl`
- `todos/`
- `plans/`
- `projects/*/memory/`
- `settings.json`

## Local Files Written

The app should avoid modifying Claude Code source data unless a feature explicitly requires it and the UI makes that clear.

Known write behavior:

- The CLI/runtime may prepare package runtime files outside `~/.claude/` as described in the README.
- The Memory page can edit memory files through the local API.
- Export creates a downloaded `.cclens.json` file when the user requests it.
- Import is preview-only and does not write merged sessions back into `~/.claude/`.

## Network Behavior

The dashboard is designed to run locally. It does not need a hosted backend or telemetry endpoint.

When reviewing changes, pay special attention to:

- new `fetch` calls to external origins
- analytics SDKs
- crash reporting SDKs
- remote image or script loading
- server routes that expose local file contents
- changes to host binding or CORS behavior

## Safe Review Checklist

Before releasing changes that touch filesystem, export/import, session replay, settings, or memory:

- confirm the server still binds locally by default
- verify external network calls are not introduced
- verify path traversal protections on API routes
- verify user-controlled paths cannot escape the configured Claude directory
- test malformed JSONL and missing files
- inspect generated exports for unintended sensitive fields
