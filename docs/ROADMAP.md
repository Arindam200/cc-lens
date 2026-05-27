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
- **Actionable insights**: Highlight patterns like low cache hit rate, frequent tool errors, expensive sessions, and early compaction.
- **Compatibility fixtures**: Maintain sample fixtures for known Claude Code local file formats.

## Later

- **Team aggregate mode**: Merge redacted exports from multiple machines into aggregate analytics without sharing raw transcripts.
- **Public sample dashboard**: Publish a static/sample view that demonstrates the product without private data.
- **Plugin-style metrics**: Allow advanced users to add local-only custom metrics without changing core dashboard code.

## Non-Goals

- Hosted sync by default.
- Telemetry by default.
- Uploading raw Claude Code transcripts.
- Replacing Claude Code's own files or acting as the source of truth.
