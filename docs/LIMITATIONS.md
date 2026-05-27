# Known Limitations

`cc-lens` reads local Claude Code files directly. That makes it private and useful, but it also means the app depends on file formats that can change.

## Data Accuracy

- Cost values are estimates, not billing records.
- Pricing comes from `lib/pricing.ts` and may lag provider pricing changes.
- Some older sessions may not include model, usage, branch, or compaction metadata.
- Session duration is inferred from timestamps in local files.
- Project language, line, and file-change counts depend on what Claude Code recorded.

## Import and Export

- Export files can contain sensitive local workflow data. Treat `.cclens.json` files as private.
- Import is preview-only and does not write merged sessions back into `~/.claude/`.
- Redacted export is not implemented yet.

## Compatibility

- The primary source is `~/.claude/projects/<slug>/*.jsonl`.
- `~/.claude/usage-data/session-meta/` is used as a fallback where available.
- If Claude Code changes its local file layout, some panels may show partial data until `cc-lens` is updated.
- Windows support is intended, but path handling needs more real-world testing.

## Runtime

- The packaged CLI binds to `127.0.0.1` by default.
- Setting `HOSTNAME=0.0.0.0` makes the dashboard reachable from your local network.
- Large histories can take longer to scan on cold start, although parsed sessions are cached by file modification time.

## Not Yet Built

- Demo mode.
- Parser test suite.
- Replay search and replay export.
- Local pricing overrides.
- Team aggregate mode.
