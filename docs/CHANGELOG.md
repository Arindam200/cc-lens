# Changelog

All notable changes to this project will be documented in this file.

This project follows a simple changelog format:

- `Added` for new features
- `Changed` for updates to existing behavior
- `Fixed` for bug fixes
- `Security` for vulnerability fixes or privacy hardening

## Unreleased

## 0.4.1 - 2026-06-27

### Added

- New Files & Code Churn page (`/files`): ranks the files Claude Code edited most, with per-file edit/write counts and approximate lines added/removed, plus churn-over-time, by-language, and by-project rollups. Derived entirely from `Edit`/`Write`/`MultiEdit` calls in session JSONL — no new data source.
- Plugin marketplaces are now surfaced on the Workspace page: each known marketplace from `known_marketplaces.json` shows its GitHub source, installed-plugin count, and last-updated date, and installed plugins link back to their marketplace source and show their pinned commit.
- Professional dashboard redesign with a Linear-style theme, an expanded motion vocabulary, mount transitions across pages, and a personalized "wrapped" card.
- `--demo` mode: launch the dashboard with a bundled sample dataset and animated stat counters, so it can be explored without any local `~/.claude/` history. Hosted deploys now serve this demo data instead of an empty dashboard.
- Local usage headroom gauge for the 5h and 7d windows, with reset pings and cap warnings.
- Skill (slash-command) usage is now tracked as a first-class dimension. The Tools page ranks invoked skills by call count and session reach, parsed from `Skill` tool calls in session JSONL.
- CLI flags: `--host` and `--port` (with `CC_LENS_HOST` and `PORT` env equivalents), plus `--help` / `-h` and `--version` / `-v`.

### Changed

- Redesigned session replay: tool calls are grouped and consecutive response turns are merged for a cleaner timeline.
- The CLI binds to `127.0.0.1` by default and no longer reads the shell's `HOSTNAME` variable, which some shells, containers, and WSL export as the machine name. This fixes `http://localhost` failing to load and avoids binding wider than intended. Use `--host 0.0.0.0` to opt into LAN access.

### Fixed

- Cache-savings baseline: `cacheEfficiency` now prices cache-creation tokens at the input rate (not the cache-write rate) when computing the no-cache baseline, so the "would have paid" and savings figures are no longer overstated by the cache-write premium.

## 0.4.0 - 2026-06-13

### Added

- Insights page with savings detectors that attach dollar estimates: low cache hit rate, premium models on short sessions, compaction thrash, and subscription plan fit.
- Monthly budget (stored in `~/.cc-lens/config.json`) with pacing projection, plus daily spend spike detection surfaced on Insights and Costs.
- Team feature adoption view: per-member use of plan mode, agents, skills, MCP, and web, with cost per session and idle badges.
- MCP server governance inventory on the Team page, built from tool counts already present in redacted exports.
- `cc-lens digest` command that prints a formatted summary (spend, top projects or members, savings, budget pace, spike alerts) in the terminal; supports `--days` and `--team`. Slack/webhook delivery is reserved for the managed version.
- Wrapped page: a yearly shareable stats card with PNG download, containing only aggregates.
- Contributor guide for local development and PR expectations.
- Security policy for private vulnerability reporting and local data handling.
- Privacy documentation describing local files, export behavior, and network expectations.
- GitHub issue templates for bug reports and feature requests.
- GitHub Actions CI for lint and production build checks.
- Roadmap, known limitations, and compatibility documentation for open-source users.
