import type { SessionMeta, RedactionLevel } from '@/types/claude'
import { projectDisplayName } from '@/lib/decode'

// Team exports must be safe to drop in a shared folder by default. The
// 'metrics' level keeps only numeric aggregates and coarse identifiers:
// prompts are removed, full project paths collapse to their display name
// (no home directory or org folder structure leaks), and timing series that
// could fingerprint a member's exact working pattern are dropped.
// 'titles' additionally keeps the first prompt so teammates can tell
// sessions apart.
//
// Built as an explicit allowlist (not a spread) so enrichment fields that
// ride along on parsed sessions — cwd, slug_name, and whatever gets added
// next — can never leak into an export by default.

/** Truncate an ISO timestamp to the hour. Exact times would fingerprint a
 *  member's working pattern; hour granularity matches what message_hours
 *  already shares while keeping daily rollups exact. */
function coarsenTimestamp(ts: string): string
function coarsenTimestamp(ts: string | undefined): string | undefined
function coarsenTimestamp(ts: string | undefined): string | undefined {
  if (!ts || ts.length < 13) return ts
  return `${ts.slice(0, 13)}:00:00.000Z`
}

export function redactSession(session: SessionMeta, level: RedactionLevel): SessionMeta {
  return {
    session_id: session.session_id,
    project_path: projectDisplayName(session.project_path),
    start_time: coarsenTimestamp(session.start_time),
    last_activity: coarsenTimestamp(session.last_activity),
    duration_minutes: session.duration_minutes,
    user_message_count: session.user_message_count,
    assistant_message_count: session.assistant_message_count,
    tool_counts: session.tool_counts,
    languages: session.languages,
    git_commits: session.git_commits,
    git_pushes: session.git_pushes,
    input_tokens: session.input_tokens,
    output_tokens: session.output_tokens,
    cache_creation_input_tokens: session.cache_creation_input_tokens,
    cache_read_input_tokens: session.cache_read_input_tokens,
    first_prompt: level === 'titles' ? session.first_prompt : '',
    user_interruptions: session.user_interruptions,
    user_response_times: [],
    tool_errors: session.tool_errors,
    tool_error_categories: session.tool_error_categories,
    uses_task_agent: session.uses_task_agent,
    uses_mcp: session.uses_mcp,
    uses_web_search: session.uses_web_search,
    uses_web_fetch: session.uses_web_fetch,
    lines_added: session.lines_added,
    lines_removed: session.lines_removed,
    files_modified: session.files_modified,
    message_hours: session.message_hours,
    user_message_timestamps: [],
    model_usage: session.model_usage,
  }
}

export function redactSessions(sessions: SessionMeta[], level: RedactionLevel): SessionMeta[] {
  return sessions.map(s => redactSession(s, level))
}
