![cc-lens CLI](./public/cc-lens.png)

# Claude Code Lens (cc-tap)

> **This is a Theodo Group fork of [Arindam200/cc-lens](https://github.com/Arindam200/cc-lens).**
> It adds an inspector proxy and a real-time **Live Capture** view that intercepts the raw
> requests Claude Code sends to `api.anthropic.com` — system prompt, tool schemas, cache
> breakpoints, message history, SSE response. Useful for debugging unexpected Claude Code
> behavior and for understanding how the CLI assembles its context window.

Local analytics dashboard for Claude Code. No cloud, no telemetry, just your `~/.claude/` data, visualized.

```bash
npx cc-tap
```

> Published to npm as **`cc-tap`** (the `cc-lens` name was taken). To run the latest
> straight from this fork's source instead: `npx github:theodo-group/cc-lens`.

The CLI finds a free local port, starts the dashboard, and opens it in your browser.

## What You Can See

### Overview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/dashboard-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="./public/dashboard-white.png" />
  <img alt="Dashboard overview" src="./public/dashboard-dark.png" />
</picture>

- Sessions, messages, token usage, estimated cost, and local storage.
- Trend cards with sparklines.
- Date presets for 7, 30, and 90 days, plus a custom date range picker.
- Usage over time, model distribution, peak hours, project activity, token breakdown, and recent sessions.

### Projects

![Projects](./public/projects.png)

- Searchable, sortable project grid.
- Per-project cards with sessions, duration, estimated cost, languages, git branches, MCP/agent badges, and top tools.
- Project detail pages with sessions, cost over time, language distribution, branch activity, and tool usage.

### Sessions

![Session replay and chat](./public/session-chat.png)

- Searchable session table with badges for compaction, agents, MCP, web search/fetch, and extended thinking.
- Full session replay reconstructed from JSONL.
- Assistant responses rendered as GitHub-flavored Markdown.
- Tool calls and tool results shown inline.
- File read/write/update tool results parsed into readable cards.
- Per-turn model, duration, token breakdown, and estimated cost.
- Compaction events shown in context with a token accumulation chart.

### Live Capture

![Live Capture page](./public/live-capture.png)

- Click **Live Capture** in the top bar → **Start**, then run `ANTHROPIC_BASE_URL=http://localhost:<port> claude` in a new terminal — the snippet (with the right port) is copyable from the popover.
- The **Live** page shows a real-time tail of every Anthropic API request with a side-by-side anatomy view: system prompt with cache breakpoints, tool schemas, message history, raw SSE response.
- Captures are correlated to JSONL sessions automatically and also surface under a **Raw API** tab on each session page; data is gzipped to `~/.cc-lens/payloads/` with a SQLite index.

### Costs

![Costs](./public/costs.png)

- Total estimated cost, cache savings, and estimated cost without cache.
- Cost over time and cost by project.
- Per-model token and cost breakdown.
- Cache efficiency panel.
- Pricing reference from `lib/pricing.ts`.

### Tools & Features
![Tools & features](./public/tools.png)

- Tool ranking across all sessions.
- Tool categories for file I/O, shell, agents, web, planning, todos, skills, MCP, and other calls.
- MCP server usage details.
- Feature adoption across sessions.
- Tool error analysis.
- Claude Code version history.
- Git branch analytics.

### Activity

![Activity calendar](./public/activity.png)

- GitHub-style activity calendar.
- Current streak, longest streak, active days, and most active day.
- Usage over time, peak hours, and day-of-week patterns.
- Activity can be derived from session JSONL when the stats cache is incomplete.

### Local Claude Code Files

![Todos](./public/todos.png)

- **History**: Search and page through `~/.claude/history.jsonl`.
- **Todos**: Browse todos from `~/.claude/todos/` with search and status filters.
- **Plans**: Read saved plans from `~/.claude/plans/` with inline Markdown rendering.
- **Memory**: Browse and edit memory files across projects, with type filters and stale detection.
- **Settings**: Inspect `~/.claude/settings.json`, installed skills, plugins, MCP servers, and storage usage.

### Export & Import

![Export](./public/export.png)

- Export a portable `.cclens.json` file containing stats, session metadata, facets, and recent command history.
- Preview export counts before downloading.
- Optionally filter exports by session start date.
- Drop an export file to preview an additive merge from another machine.

Import is intentionally preview-only right now. It shows which sessions are new or already present, but it does not write merged data back into `~/.claude/`, to avoid corrupting live Claude Code files.

## Navigation

![Global search (Command K)](./public/command-k.png)

- Global search: `Cmd+K`, `Ctrl+K`, or `/`.
- Session list keyboard navigation: `j` / `k` to move, `Enter` to open, `Esc` to clear.
- Page shortcuts: `g` plus a page key, for example `g s` for sessions, `g p` for projects, `g c` for costs.
- Responsive layout with desktop sidebar, collapsible navigation, mobile bottom nav, and mobile menu.
- Light and dark themes.

## Multiple Claude Profiles

By default, `cc-tap` reads `~/.claude/`. To point it at another Claude Code config directory, set `CLAUDE_CONFIG_DIR`:

```bash
# Default profile
npx cc-tap

# Work profile
CLAUDE_CONFIG_DIR=~/.claude-work npx cc-tap
```

On Windows PowerShell:

```powershell
$env:CLAUDE_CONFIG_DIR="C:\Users\you\.claude-work"; npx cc-tap
```

The active config directory is shown in the CLI banner on launch.

## Run From Source

### Prerequisites

- Node.js 18+
- Claude Code with local data in `~/.claude/`

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), or the port shown in your terminal.

### Production Build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

## Project Docs

- [Roadmap](./docs/ROADMAP.md): planned improvements and non-goals.
- [Known limitations](./docs/LIMITATIONS.md): accuracy, compatibility, and runtime caveats.
- [Compatibility](./docs/COMPATIBILITY.md): supported local files and reporting guidance.
- [Contributing](./docs/CONTRIBUTING.md): local setup, PR expectations, and manual test notes.
- [Privacy](./docs/PRIVACY.md): what data is read, exported, or edited.
- [Security](./docs/SECURITY.md): private vulnerability reporting and review checklist.

## Data Sources

`cc-tap` reads local Claude Code files directly:

- `~/.claude/projects/<slug>/*.jsonl`: session JSONL and replay data
- `~/.claude/stats-cache.json`: aggregate stats when available
- `~/.claude/usage-data/session-meta/`: session metadata fallback
- `~/.claude/history.jsonl`: command history
- `~/.claude/todos/`: todo files
- `~/.claude/plans/`: saved plan files
- `~/.claude/projects/*/memory/`: project memory files
- `~/.claude/settings.json`: settings, skills, plugins, and MCP config

Dashboard data refreshes every 5 seconds while the app is open.

## Cost Estimates

Claude Code stores token counts and model identifiers, not final billing totals. `cc-tap` estimates cost using the pricing table in `lib/pricing.ts`. If provider pricing changes, update that file to keep estimates current.
