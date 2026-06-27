#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Synthesize a fully fictional ~/.claude-shaped dataset for cc-lens demo mode.
//
// Nothing here is read from a real machine. It writes the same files the live
// dashboard parses — stats-cache.json, projects/<slug>/*.jsonl, history.jsonl,
// settings.json, plans/, tasks/, and project memory — so every page renders
// with believable data and zero private exposure.
//
// Usage:
//   node bin/generate-sample.js [--out <dir>] [--days <n>] [--seed <n>]
//
// Default --out is <package>/sample-data/.claude. The CLI's `--demo` flag
// regenerates into a cache dir on each launch so dates always end "today".

const fs = require('fs')
const path = require('path')
const os = require('os')

// ─── args ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t.startsWith('--')) {
      const k = t.slice(2)
      const n = argv[i + 1]
      if (n !== undefined && !n.startsWith('--')) { a[k] = n; i++ } else a[k] = true
    } else a._.push(t)
  }
  return a
}

// ─── seeded RNG (mulberry32) so the demo is reproducible per seed ────────────
function rng(seed) {
  let s = seed >>> 0
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── fictional content ───────────────────────────────────────────────────────
const MODELS = [
  'claude-opus-4-8-20260115',
  'claude-sonnet-4-6-20251101',
  'claude-haiku-4-5-20251001',
]
const VERSIONS = ['2.1.62', '2.1.59', '2.1.55', '2.1.52']
const BRANCHES = ['main', 'feat/auth', 'fix/checkout', 'feat/dashboard', 'chore/deps', 'feat/api-v2']

// slug dirs decode to /Users/<name>/<path> — all fictional
const PROJECTS = [
  { slug: '-Users-devon-code-acme-web',        path: '/Users/devon/code/acme-web',        name: 'acme-web',        langs: ['TypeScript', 'CSS'] },
  { slug: '-Users-devon-code-payments-api',    path: '/Users/devon/code/payments-api',    name: 'payments-api',    langs: ['Go', 'SQL'] },
  { slug: '-Users-devon-code-ml-pipeline',     path: '/Users/devon/code/ml-pipeline',     name: 'ml-pipeline',     langs: ['Python', 'YAML'] },
  { slug: '-Users-devon-code-mobile-app',      path: '/Users/devon/code/mobile-app',      name: 'mobile-app',      langs: ['TypeScript', 'Swift'] },
  { slug: '-Users-devon-code-infra-terraform', path: '/Users/devon/code/infra-terraform', name: 'infra-terraform', langs: ['HCL', 'Shell'] },
]

const SLUGS = [
  'luminous-napping-squid', 'joyful-bouncing-alpaca', 'crimson-wandering-otter',
  'gentle-humming-finch', 'electric-dozing-lynx', 'amber-drifting-heron',
  'quiet-spinning-moth', 'brave-floating-koi', 'velvet-roaming-stag',
  'cobalt-singing-wren', 'sunny-tumbling-fox', 'misty-gliding-tern',
]

const PROMPTS = [
  'add optimistic updates to the cart so the UI feels instant',
  'the checkout flow throws a 500 on empty carts, find and fix the root cause',
  'refactor the auth middleware to use the new session helper',
  'write integration tests for the payments webhook handler',
  'why is the dashboard query so slow? profile it and propose a fix',
  'migrate the user table to add a soft-delete column without downtime',
  'set up a GitHub Action that runs lint, typecheck and tests on every PR',
  'the mobile build fails on CI but works locally, figure out why',
  'add rate limiting to the public API endpoints',
  'generate a wrapped-style summary card component from this design',
  'clean up the dead code flagged by the linter across the repo',
  'document the deployment process in a runbook',
  'add dark mode support across the settings page',
  'the terraform plan wants to recreate the database, stop it from doing that',
  'batch the N+1 queries in the project list endpoint',
]

const TITLES = [
  'Fix 500 on empty cart checkout', 'Optimistic cart updates', 'Auth middleware refactor',
  'Payments webhook tests', 'Slow dashboard query profiling', 'Soft-delete migration',
  'CI pipeline setup', 'Mobile CI build failure', 'API rate limiting',
  'Wrapped card component', 'Repo-wide dead code cleanup', 'Deployment runbook',
  'Settings dark mode', 'Terraform DB recreate fix', 'N+1 query batching',
]

const TOOLS = ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'TodoWrite']
const MCP_TOOLS = ['mcp__github__create_pr', 'mcp__postgres__run_query', 'mcp__sentry__list_issues']
const SKILLS = ['code-review', 'investigate', 'browse', 'ship', 'qa']

const ASSISTANT_TEXT = [
  "I'll start by reading the relevant files to understand the current behavior.",
  "Found it. The handler assumes a non-empty items array. Let me add a guard and a test.",
  "Profiling shows the query runs once per row. I'll batch it into a single fetch.",
  "Here's the plan: add the column nullable, backfill, then flip the constraint.",
  "Tests pass. The fix is scoped to the webhook handler and doesn't touch routing.",
  "I've wired up the action with caching so cold installs don't dominate the run time.",
  "That recreate is triggered by a changed default. Pinning it keeps the DB in place.",
]

// ─── helpers ──────────────────────────────────────────────────────────────────
function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)] }
function intBetween(rand, lo, hi) { return Math.floor(lo + rand() * (hi - lo + 1)) }
function uuid(rand) {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) out += '-'
    out += hex[Math.floor(rand() * 16)]
  }
  return out
}
function rmrf(dir) { fs.rmSync(dir, { recursive: true, force: true }) }

// Guard against a typo'd/misconfigured --out wiping a real directory: the demo
// dataset always lives in a dir whose final segment is `.claude`, so refuse to
// recursively delete anything else (root, $HOME, an arbitrary project, etc.).
function assertSafeOutDir(dir) {
  const resolved = path.resolve(dir)
  const unsafe =
    path.basename(resolved) !== '.claude' ||
    resolved === path.parse(resolved).root ||
    resolved === os.homedir()
  if (unsafe) {
    throw new Error(
      `refusing to generate into ${resolved}: --out must point at a dir ending in ".claude"`
    )
  }
}
function writeJSON(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n')
}

// Build one session JSONL as an array of line objects.
function buildSession(rand, { project, dayStart, sessionId, slug, version, branch, title }) {
  const lines = []
  const model = rand() < 0.55 ? MODELS[0] : rand() < 0.7 ? MODELS[1] : MODELS[2]
  const turns = intBetween(rand, 4, 16)
  let t = dayStart + intBetween(rand, 0, 6) * 3600_000 + intBetween(rand, 0, 59) * 60_000
  let parent = null
  const common = () => ({
    parentUuid: parent,
    isSidechain: false,
    cwd: project.path,
    sessionId,
    version,
    gitBranch: branch,
    slug,
  })
  const advance = () => { t += intBetween(rand, 20, 240) * 1000 }

  // first user prompt
  const firstPrompt = pick(rand, PROMPTS)
  const u0 = { ...common(), type: 'user', message: { role: 'user', content: firstPrompt }, uuid: uuid(rand), timestamp: new Date(t).toISOString() }
  lines.push(u0); parent = u0.uuid; advance()

  // ai-title (refined name shown in the UI)
  lines.push({ ...common(), type: 'ai-title', aiTitle: title, uuid: uuid(rand), timestamp: new Date(t).toISOString() })

  const useThinking = rand() < 0.4
  const useMcp = rand() < 0.35
  const useWeb = rand() < 0.2
  const useSkill = rand() < 0.45
  const willCompact = turns > 11 && rand() < 0.5

  for (let i = 0; i < turns; i++) {
    advance()
    // assistant turn
    const content = []
    if (useThinking && i === 0) content.push({ type: 'thinking', thinking: 'Let me reason about the failure mode before editing.', signature: 'demo' })
    content.push({ type: 'text', text: pick(rand, ASSISTANT_TEXT) })

    const toolCount = intBetween(rand, 0, 3)
    const toolCalls = []
    for (let k = 0; k < toolCount; k++) {
      let name = pick(rand, TOOLS)
      if (useMcp && k === 0 && rand() < 0.5) name = pick(rand, MCP_TOOLS)
      if (useWeb && k === 0 && rand() < 0.4) name = rand() < 0.5 ? 'WebSearch' : 'WebFetch'
      if (useSkill && i === 0 && k === 0) name = 'Skill'
      const ext = project.langs[0] === 'Go' ? 'go' : 'ts'
      const filePath = `${project.path}/src/${pick(rand, ['index', 'handler', 'routes', 'db', 'utils'])}.${ext}`
      // Build a chunk of N source-like lines, so Edit/Write churn is non-zero.
      const lines = (n) => Array.from({ length: n }, (_, j) => `  line${j} = compute(${j})`).join('\n')
      const input =
        name === 'Skill' ? { skill: pick(rand, SKILLS) } :
        name === 'Bash' ? { command: pick(rand, ['npm test', 'go build ./...', 'git status', 'npm run lint']) } :
        name === 'Read' ? { file_path: filePath } :
        name === 'Write' ? { file_path: filePath, content: lines(intBetween(rand, 12, 60)) } :
        name === 'Edit' ? { file_path: filePath, old_string: lines(intBetween(rand, 1, 6)), new_string: lines(intBetween(rand, 2, 14)) } :
        name === 'Grep' || name === 'Glob' ? { pattern: pick(rand, ['TODO', 'function', 'export', 'import']) } :
        {}
      const tu = { type: 'tool_use', id: `toolu_${uuid(rand).slice(0, 12)}`, name, input }
      content.push(tu)
      toolCalls.push(tu)
    }

    // token usage scaled by model + growth over the conversation
    const base = model.startsWith('claude-opus') ? 1.0 : model.startsWith('claude-sonnet') ? 0.6 : 0.3
    const inputTokens = intBetween(rand, 200, 1200)
    const outputTokens = Math.round(intBetween(rand, 150, 900) * base)
    const cacheRead = intBetween(rand, 8000, 60000) + i * 3000
    const cacheWrite = i === 0 ? intBetween(rand, 4000, 20000) : intBetween(rand, 0, 4000)

    const a = {
      ...common(),
      type: 'assistant',
      message: {
        role: 'assistant',
        model,
        content,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_input_tokens: cacheRead,
          cache_creation_input_tokens: cacheWrite,
          cache_creation: { ephemeral_5m_input_tokens: cacheWrite, ephemeral_1h_input_tokens: 0 },
          service_tier: 'standard',
        },
      },
      uuid: uuid(rand),
      timestamp: new Date(t).toISOString(),
    }
    lines.push(a); parent = a.uuid

    // turn_duration system line
    advance()
    lines.push({ ...common(), type: 'system', subtype: 'turn_duration', durationMs: intBetween(rand, 4000, 90000), uuid: uuid(rand), timestamp: new Date(t).toISOString() })

    // tool results come back as a user turn
    if (toolCalls.length) {
      advance()
      const tr = {
        ...common(),
        type: 'user',
        message: {
          role: 'user',
          content: toolCalls.map((tc) => ({
            type: 'tool_result',
            tool_use_id: tc.id,
            content: rand() < 0.08 ? 'Error: command failed with exit code 1' : 'ok',
            is_error: rand() < 0.08,
          })),
        },
        uuid: uuid(rand),
        timestamp: new Date(t).toISOString(),
      }
      lines.push(tr); parent = tr.uuid
    }

    // a follow-up user message mid-session
    if (i > 0 && i < turns - 1 && rand() < 0.35) {
      advance()
      const uf = { ...common(), type: 'user', message: { role: 'user', content: pick(rand, ['looks good, now add a test for the empty case', 'ship it', 'can you also handle the timeout path?', 'why did that change break the build?']) }, uuid: uuid(rand), timestamp: new Date(t).toISOString() }
      lines.push(uf); parent = uf.uuid
    }

    // compaction midway through long sessions
    if (willCompact && i === Math.floor(turns / 2)) {
      advance()
      lines.push({
        ...common(),
        type: 'system',
        subtype: 'compact_boundary',
        compactMetadata: { trigger: rand() < 0.7 ? 'auto' : 'manual', preTokens: intBetween(rand, 120000, 175000) },
        uuid: uuid(rand),
        timestamp: new Date(t).toISOString(),
      })
    }
  }

  // trailing summary line
  lines.push({ type: 'summary', summary: title, leafUuid: parent })
  return lines
}

function generate(outDir, opts) {
  const rand = rng(opts.seed)
  const days = opts.days
  const now = Date.now()
  const dayMs = 86400_000

  assertSafeOutDir(outDir)
  rmrf(outDir)
  fs.mkdirSync(outDir, { recursive: true })

  // ── aggregate accumulators for stats-cache.json ──
  const dailyActivity = []
  const tokensByDate = []
  const dailyModelTokens = []
  const modelUsage = {}
  const hourCounts = {}
  let totalSessions = 0
  let totalMessages = 0
  let longest = { sessionId: '', duration: 0, messageCount: 0, timestamp: '' }
  const historyEntries = []
  let slugIdx = 0

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = now - d * dayMs
    const date = new Date(dayStart).toISOString().slice(0, 10)
    // weekends quieter, ~30% of days idle
    const dow = new Date(dayStart).getDay()
    const idle = rand() < (dow === 0 || dow === 6 ? 0.6 : 0.2)
    let dayMessages = 0
    let daySessions = 0
    let dayTools = 0
    const dayTokensByModel = {}

    const sessionsToday = idle ? 0 : intBetween(rand, 1, 4)
    for (let s = 0; s < sessionsToday; s++) {
      const project = pick(rand, PROJECTS)
      const sessionId = uuid(rand)
      const slug = SLUGS[slugIdx++ % SLUGS.length]
      const version = pick(rand, VERSIONS)
      const branch = pick(rand, BRANCHES)
      const titleIdx = intBetween(rand, 0, TITLES.length - 1)
      const title = TITLES[titleIdx]

      const lines = buildSession(rand, { project, dayStart, sessionId, slug, version, branch, title })
      const jsonl = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
      const file = path.join(outDir, 'projects', project.slug, `${sessionId}.jsonl`)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, jsonl)

      // accumulate aggregates from generated lines
      let sessMsgs = 0
      let firstTs = null
      let lastTs = null
      for (const l of lines) {
        if (l.timestamp) { if (!firstTs) firstTs = l.timestamp; lastTs = l.timestamp }
        if (l.type === 'user' && typeof l.message?.content === 'string') {
          historyEntries.push({ display: l.message.content, timestamp: Math.floor(new Date(l.timestamp).getTime()), project: project.path })
        }
        if (l.type === 'user' || l.type === 'assistant') { sessMsgs++; dayMessages++ }
        if (l.type === 'assistant') {
          const h = new Date(l.timestamp).getHours()
          hourCounts[h] = (hourCounts[h] ?? 0) + 1
          const u = l.message?.usage
          const m = l.message?.model
          if (u && m) {
            const mu = (modelUsage[m] = modelUsage[m] ?? { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0, webSearchRequests: 0 })
            mu.inputTokens += u.input_tokens
            mu.outputTokens += u.output_tokens
            mu.cacheReadInputTokens += u.cache_read_input_tokens
            mu.cacheCreationInputTokens += u.cache_creation_input_tokens
            const tot = u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
            dayTokensByModel[m] = (dayTokensByModel[m] ?? 0) + tot
          }
          for (const c of l.message?.content ?? []) {
            if (c.type === 'tool_use') {
              dayTools++
              if (c.name === 'WebSearch' && m) modelUsage[m].webSearchRequests++
            }
          }
        }
      }
      daySessions++
      totalSessions++
      const durMin = firstTs && lastTs ? (new Date(lastTs) - new Date(firstTs)) / 60000 : 0
      if (durMin > longest.duration) longest = { sessionId, duration: durMin, messageCount: sessMsgs, timestamp: firstTs }
    }

    totalMessages += dayMessages
    dailyActivity.push({ date, messageCount: dayMessages, sessionCount: daySessions, toolCallCount: dayTools })
    const dayTotalTokens = Object.values(dayTokensByModel).reduce((a, b) => a + b, 0)
    tokensByDate.push({ date, tokensByModel: dayTokensByModel })
    dailyModelTokens.push({ date, tokensByModel: dayTokensByModel })
    void dayTotalTokens
  }

  // cost per model (mirror lib/pricing default rates / MTok)
  const RATES = {
    'claude-opus-4-8': { i: 5, o: 25, cw: 6.25, cr: 0.5 },
    'claude-sonnet-4-6': { i: 3, o: 15, cw: 3.75, cr: 0.3 },
    'claude-haiku-4-5': { i: 1, o: 5, cw: 1.25, cr: 0.1 },
  }
  function rateFor(model) {
    for (const key of Object.keys(RATES)) if (model.startsWith(key)) return RATES[key]
    return RATES['claude-opus-4-8']
  }
  for (const [model, mu] of Object.entries(modelUsage)) {
    const r = rateFor(model)
    mu.costUSD = (mu.inputTokens * r.i + mu.outputTokens * r.o + mu.cacheCreationInputTokens * r.cw + mu.cacheReadInputTokens * r.cr) / 1_000_000
  }

  const firstSessionDate = dailyActivity[0]?.date ?? new Date(now).toISOString().slice(0, 10)
  const statsCache = {
    version: 3,
    lastComputedDate: new Date(now).toISOString().slice(0, 10),
    dailyActivity,
    tokensByDate,
    dailyModelTokens,
    modelUsage,
    totalSessions,
    totalMessages,
    longestSession: longest,
    firstSessionDate,
    hourCounts,
    totalSpeculationTimeSavedMs: intBetween(rand, 200000, 900000),
  }
  writeJSON(path.join(outDir, 'stats-cache.json'), statsCache)

  // history.jsonl (most recent last)
  historyEntries.sort((a, b) => a.timestamp - b.timestamp)
  fs.writeFileSync(path.join(outDir, 'history.jsonl'), historyEntries.map((e) => JSON.stringify(e)).join('\n') + '\n')

  // settings.json
  writeJSON(path.join(outDir, 'settings.json'), {
    model: 'claude-opus-4-8',
    includeCoAuthoredBy: false,
    enableAllProjectMcpServers: false,
    permissions: { allow: ['Bash(npm test)', 'Bash(go build:*)', 'Read(*)'], deny: [] },
  })

  // a couple of plans
  const plansDir = path.join(outDir, 'plans')
  fs.mkdirSync(plansDir, { recursive: true })
  fs.writeFileSync(path.join(plansDir, 'payments-refactor.md'), '# Payments webhook hardening\n\n- [x] Reproduce the 500 on empty carts\n- [x] Add guard + unit test\n- [ ] Backfill idempotency keys\n- [ ] Roll out behind a flag\n')
  fs.writeFileSync(path.join(plansDir, 'dashboard-perf.md'), '# Dashboard performance\n\n- [x] Profile the project list query\n- [x] Batch the N+1\n- [ ] Add a covering index\n')

  // tasks (TodoWrite-style, per session)
  const taskSession = uuid(rand)
  const tasksDir = path.join(outDir, 'tasks', taskSession)
  fs.mkdirSync(tasksDir, { recursive: true })
  const sampleTasks = [
    { content: 'Add guard for empty cart', status: 'completed' },
    { content: 'Write regression test', status: 'completed' },
    { content: 'Wire up CI workflow', status: 'in_progress' },
    { content: 'Document the runbook', status: 'pending' },
  ]
  sampleTasks.forEach((t, i) => writeJSON(path.join(tasksDir, `task-${i + 1}.json`), { id: `task-${i + 1}`, ...t, activeForm: t.content }))

  // plugins + marketplaces (workspace page)
  const pluginsDir = path.join(outDir, 'plugins')
  fs.mkdirSync(pluginsDir, { recursive: true })
  writeJSON(path.join(pluginsDir, 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'pyright-lsp@claude-plugins-official': [
        { scope: 'user', version: '1.0.0', installedAt: '2026-02-27T09:48:20.889Z', lastUpdated: '2026-02-27T09:48:20.889Z', gitCommitSha: '55b58ec6e5649104f926ba7558b567dc8d33c5ff' },
      ],
      'security-guidance@claude-plugins-official': [
        { scope: 'user', version: '2.0.6', installedAt: '2026-05-27T04:13:04.604Z', lastUpdated: '2026-06-12T15:25:33.567Z' },
      ],
    },
  })
  writeJSON(path.join(pluginsDir, 'known_marketplaces.json'), {
    'claude-plugins-official': {
      source: { source: 'github', repo: 'anthropics/claude-plugins-official' },
      lastUpdated: '2026-06-27T06:38:19.046Z',
    },
  })

  // project memory (workspace page)
  const memDir = path.join(outDir, 'projects', PROJECTS[0].slug, 'memory')
  fs.mkdirSync(memDir, { recursive: true })
  fs.writeFileSync(path.join(memDir, 'MEMORY.md'), '# acme-web notes\n\n- Cart state lives in a Zustand store, not React context.\n- The checkout 500 was an empty-array assumption in the webhook handler.\n')

  // ~/.claude.json equivalent for plan detection lives in $HOME, but we drop a
  // copy beside the demo config dir so plan-aware UI has something to read. The
  // reader prefers CLAUDE_CONFIG_DIR/.claude.json in demo mode and parses the
  // real file's shape (oauthAccount.organizationType), so match it here.
  writeJSON(path.join(outDir, '.claude.json'), { oauthAccount: { organizationType: 'max20x' } })

  return { totalSessions, totalMessages, days, projects: PROJECTS.length }
}

// ─── main ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2))
  const outDir = args.out
    ? path.resolve(String(args.out))
    : path.join(__dirname, '..', 'sample-data', '.claude')
  const days = Number(args.days) >= 1 ? Math.floor(Number(args.days)) : 90
  const seed = Number(args.seed) >= 0 ? Math.floor(Number(args.seed)) : 42

  const res = generate(outDir, { days, seed })
  console.log(`Generated demo dataset → ${outDir}`)
  console.log(`  ${res.totalSessions} sessions, ${res.totalMessages} messages, ${res.projects} projects, ${res.days} days`)
}

module.exports = { generate }
