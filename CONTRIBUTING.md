# Contributing to Claude Code Lens

Thanks for helping improve `cc-lens`. This project reads private local Claude Code data, so contributions should preserve the local-first, no-telemetry model.

## Development Setup

Requirements:

- Node.js 18 or newer
- npm
- Claude Code data in `~/.claude/` for realistic local testing

Install and run:

```bash
npm install
npm run dev
```

Open the local URL shown by Next.js, usually <http://localhost:3000>.

Build and lint before opening a PR:

```bash
npm run lint
npm run build
```

## Project Structure

- `app/`: Next.js app routes and API routes
- `components/`: shared UI and dashboard components
- `lib/claude-reader.ts`: local Claude Code file readers
- `lib/replay-parser.ts`: session JSONL replay parsing
- `lib/pricing.ts`: token and cost estimation
- `types/claude.ts`: shared app types
- `bin/cli.js`: published `cc-lens` CLI entrypoint

## Contribution Guidelines

- Keep the app local-first. Do not add hosted services, telemetry, analytics, or external upload paths.
- Treat `~/.claude/` content as private user data.
- Bind local servers to loopback by default unless the user explicitly opts into another host.
- Prefer small PRs with a clear user-facing outcome.
- Add focused tests when changing parsing, pricing, import/export, or filesystem behavior.
- Preserve compatibility with missing, partial, or malformed Claude Code files.
- Avoid broad refactors unless they directly support the change.

## Testing Changes Manually

For parser or filesystem changes, test at least these cases:

- default `~/.claude/`
- custom `CLAUDE_CONFIG_DIR`
- missing config directory
- empty projects directory
- malformed JSONL line
- sessions with tool calls, compaction, and cache tokens

Example custom profile run:

```bash
CLAUDE_CONFIG_DIR=~/.claude-work npm run dev
```

## Pull Request Checklist

- [ ] The change keeps user data local.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] User-facing behavior is documented when relevant.
- [ ] Screenshots or short recordings are included for visible UI changes.
- [ ] Parser/filesystem changes handle missing or malformed local files.

## Reporting Security Issues

Please do not open a public issue for vulnerabilities involving private data exposure. See [SECURITY.md](SECURITY.md) for reporting guidance.
