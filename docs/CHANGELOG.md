# Changelog

All notable changes to this project will be documented in this file.

This project follows a simple changelog format:

- `Added` for new features
- `Changed` for updates to existing behavior
- `Fixed` for bug fixes
- `Security` for vulnerability fixes or privacy hardening

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
