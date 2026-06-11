// ─── Stats Cache ─────────────────────────────────────────────────────────────

export interface DailyActivity {
  date: string
  messageCount: number
  sessionCount: number
  toolCallCount: number
}

export interface DailyTokens {
  date: string
  tokensByModel: Record<string, number>
}

export interface ModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  costUSD: number
  webSearchRequests: number
}

export interface LongestSession {
  sessionId: string
  duration: number
  messageCount: number
  timestamp: string
}

export interface StatsCache {
  version: number
  lastComputedDate: string
  dailyActivity: DailyActivity[]
  tokensByDate: DailyTokens[]
  dailyModelTokens?: DailyTokens[]
  modelUsage: Record<string, ModelUsage>
  totalSessions: number
  totalMessages: number
  longestSession: LongestSession
  firstSessionDate: string
  hourCounts: Record<string, number>
  totalSpeculationTimeSavedMs: number
}

// ─── Session Meta ─────────────────────────────────────────────────────────────

export interface SessionMeta {
  session_id: string
  project_path: string
  start_time: string
  last_activity?: string
  duration_minutes: number
  user_message_count: number
  assistant_message_count: number
  tool_counts: Record<string, number>
  languages: Record<string, number>
  git_commits: number
  git_pushes: number
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  first_prompt: string
  user_interruptions: number
  user_response_times: number[]
  tool_errors: number
  tool_error_categories: Record<string, number>
  uses_task_agent: boolean
  uses_mcp: boolean
  uses_web_search: boolean
  uses_web_fetch: boolean
  lines_added: number
  lines_removed: number
  files_modified: number
  message_hours: number[]
  user_message_timestamps: string[]
  model_usage?: Record<string, ModelUsage>
}

// ─── Facets ──────────────────────────────────────────────────────────────────

export interface Facet {
  session_id: string
  underlying_goal: string
  goal_categories: Record<string, number>
  outcome: string
  user_satisfaction_counts: Record<string, number>
  claude_helpfulness: string
  session_type: string
  friction_counts: Record<string, number>
  friction_detail: string
  primary_success: string
  brief_summary: string
}

// ─── Session with Facet joined ───────────────────────────────────────────────

export interface SessionWithFacet extends SessionMeta {
  facet?: Facet
  estimated_cost: number
  slug?: string
  ai_title?: string
  version?: string
  git_branch?: string
  has_compaction?: boolean
  has_thinking?: boolean
}

// ─── Live Sessions (~/.claude/sessions) ──────────────────────────────────────

export interface LiveSession {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  version?: string
  kind?: string
  entrypoint?: string
  status?: string
  updatedAt?: number
}

// ─── Replay / JSONL ──────────────────────────────────────────────────────────

export interface TurnUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  cache_creation?: {
    ephemeral_5m_input_tokens: number
    ephemeral_1h_input_tokens: number
  }
  service_tier?: string
  inference_geo?: string
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  is_error?: boolean
}

export interface ReplayTurn {
  uuid: string
  parentUuid: string | null
  type: 'user' | 'assistant'
  is_sidechain?: boolean
  timestamp: string
  model?: string
  usage?: TurnUsage
  text?: string
  tool_calls?: ToolCall[]
  tool_results?: Array<{ tool_use_id: string; content: string; is_error: boolean }>
  has_thinking?: boolean
  thinking_text?: string
  estimated_cost?: number
  turn_duration_ms?: number
  response_time_s?: number
}

export interface CompactionEvent {
  uuid: string
  timestamp: string
  trigger: 'auto' | 'manual'
  pre_tokens: number
  summary?: string
  turn_index: number
}

export interface SummaryEvent {
  uuid: string
  summary: string
  leaf_uuid: string
}

export interface ReplayData {
  session_id: string
  slug?: string
  ai_title?: string
  version?: string
  git_branch?: string
  turns: ReplayTurn[]
  compactions: CompactionEvent[]
  summaries: SummaryEvent[]
  total_cost: number
}

// ─── Project Summary ──────────────────────────────────────────────────────────

export interface ProjectSummary {
  slug: string
  project_path: string
  display_name: string
  session_count: number
  total_messages: number
  total_duration_minutes: number
  total_lines_added: number
  total_lines_removed: number
  total_files_modified: number
  git_commits: number
  git_pushes: number
  estimated_cost: number
  input_tokens: number
  output_tokens: number
  languages: Record<string, number>
  tool_counts: Record<string, number>
  last_active: string
  first_active: string
  uses_mcp: boolean
  uses_task_agent: boolean
  branches: string[]
}

// ─── Project Trends ──────────────────────────────────────────────────────────

export interface ProjectTrendPoint {
  date: string
  sessions: number
  messages: number
  duration_minutes: number
  estimated_cost: number
  input_tokens: number
  output_tokens: number
  tool_calls: number
  agent_sessions: number
  mcp_sessions: number
  web_search_sessions: number
  tool_errors: number
}

export interface ProjectTrendDelta {
  sessions_pct: number | null
  estimated_cost_pct: number | null
  duration_pct: number | null
  tool_calls_pct: number | null
}

export interface ProjectTrend {
  slug: string
  project_path: string
  display_name: string
  current: ProjectTrendPoint
  previous: ProjectTrendPoint
  delta: ProjectTrendDelta
  series: ProjectTrendPoint[]
}

// ─── Tool Analytics ───────────────────────────────────────────────────────────

export interface ToolSummary {
  name: string
  category: string
  total_calls: number
  session_count: number
  error_count: number
}

export interface McpServerSummary {
  server_name: string
  tools: Array<{ name: string; calls: number }>
  total_calls: number
  session_count: number
}

export interface VersionRecord {
  version: string
  session_count: number
  first_seen: string
  last_seen: string
}

export interface ToolsAnalytics {
  tools: ToolSummary[]
  mcp_servers: McpServerSummary[]
  feature_adoption: Record<string, { sessions: number; pct: number }>
  versions: VersionRecord[]
  branches: Array<{ branch: string; turns: number }>
  error_categories: Record<string, number>
  total_tool_calls: number
  total_errors: number
}

// ─── Cost Analytics ───────────────────────────────────────────────────────────

export interface ModelCostBreakdown {
  model: string
  input_tokens: number
  output_tokens: number
  cache_write_tokens: number
  cache_read_tokens: number
  estimated_cost: number
  cache_savings: number
  cache_hit_rate: number
}

export interface DailyCost {
  date: string
  costs: Record<string, number>
  total: number
}

export interface ProjectCost {
  slug: string
  display_name: string
  estimated_cost: number
  input_tokens: number
  output_tokens: number
}

export interface CostAnalytics {
  total_cost: number
  total_savings: number
  models: ModelCostBreakdown[]
  daily: DailyCost[]
  by_project: ProjectCost[]
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  display: string
  timestamp: number
  project: string
  sessionId?: string
}

// ─── Export ──────────────────────────────────────────────────────────────────

export interface ExportPayload {
  exportedAt: string
  version: string
  stats: StatsCache | null
  sessions: SessionMeta[]
  facets: Facet[]
  history: HistoryEntry[]
}

export interface ImportDiff {
  total_in_export: number
  already_present: number
  new_sessions: number
  sessions_to_add: SessionMeta[]
}

// ─── Team Mode ────────────────────────────────────────────────────────────────

/** How much detail a member shares in a team export. */
export type RedactionLevel = 'metrics' | 'titles'

export interface TeamMember {
  /** Display name chosen by the member (e.g. "Arindam" or git author name) */
  name: string
  /** Optional, for PR/commit attribution */
  email?: string
  /** Optional machine label to distinguish multiple machines per person */
  machine?: string
}

export interface TeamExportPayload {
  kind: 'cclens-team-export'
  version: string
  exportedAt: string
  member: TeamMember
  redaction: RedactionLevel
  /** Claude Code versions seen in this member's sessions */
  cc_versions: string[]
  sessions: SessionMeta[]
}

/** Per-member counts of sessions that used each Claude Code capability */
export interface TeamFeatureAdoption {
  plan_mode: number
  agents: number
  mcp: number
  web: number
  skills: number
}

/** One MCP server observed in team tool_counts, for governance review */
export interface TeamMcpServer {
  server: string
  total_calls: number
  members: string[]
}

export interface TeamMemberSummary {
  member: TeamMember
  exportedAt: string
  redaction: RedactionLevel
  session_count: number
  total_messages: number
  total_duration_minutes: number
  estimated_cost: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cache_hit_rate: number
  tool_errors: number
  uses_mcp_sessions: number
  uses_agent_sessions: number
  last_active: string
  first_active: string
  cc_versions: string[]
  top_projects: Array<{ name: string; sessions: number; cost: number }>
  models: Record<string, ModelUsage>
  adoption: TeamFeatureAdoption
  cost_per_session: number
}

export interface TeamDailyPoint {
  date: string
  /** member name → estimated cost that day */
  cost_by_member: Record<string, number>
  /** member name → session count that day */
  sessions_by_member: Record<string, number>
  total_cost: number
  total_sessions: number
}

export interface TeamAnalytics {
  source_dir: string
  member_count: number
  export_count: number
  total_cost: number
  total_sessions: number
  total_messages: number
  total_cache_savings: number
  members: TeamMemberSummary[]
  daily: TeamDailyPoint[]
  /** Claude Code version → members running it (version skew view) */
  version_skew: Array<{ version: string; members: string[] }>
  models: Record<string, ModelUsage>
  /** Every MCP server seen in member tool counts, most-used first */
  mcp_servers: TeamMcpServer[]
  errors: string[]
}
