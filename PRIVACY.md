# Privacy

Claude Code Lens is a local-first dashboard for Claude Code data. It is designed so your Claude Code history remains on your machine.

## What Data Is Used

By default, `cc-lens` reads from `~/.claude/`. You can point it at another profile with `CLAUDE_CONFIG_DIR`.

The app may display:

- session metadata
- prompts and assistant responses from session JSONL files
- tool calls and tool results
- token usage and estimated costs
- project paths, git branches, and language signals
- command history
- todos, plans, memories, settings, skills, plugins, and MCP configuration

This data can be sensitive because it may include source code paths, command output, private prompts, project names, and local workflow details.

## What Leaves Your Machine

Nothing is intentionally uploaded by `cc-lens`.

The app does not require:

- a login
- an API key
- a hosted backend
- telemetry
- cloud sync

The CLI starts a local web server. The packaged CLI binds to `127.0.0.1` by default. If you set `HOSTNAME=0.0.0.0`, you are explicitly making the dashboard reachable from other devices on your network.

## Exports

The Export page can generate a portable `.cclens.json` file when you request it. Treat this file as private because it may contain session metadata, facets, and command history.

Before sharing an export, inspect it and remove anything sensitive.

## Imports

Import is preview-only. It shows which sessions are new or already present, but it does not write merged data back into `~/.claude/`.

## Memory Editing

The Memory page can edit local memory files. Those edits are local filesystem changes to your active Claude Code config directory.

## How To Verify

You can inspect the source for external network behavior by searching for remote fetches and analytics packages:

```bash
rg "fetch\\(|analytics|telemetry|sentry|posthog|segment|amplitude|http://" app components lib bin
rg "https://" app components lib bin
```

You can also run the app offline after dependencies are installed:

```bash
npm run dev
```

The dashboard should continue to work against local Claude Code files.
