#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn, exec } = require('child_process')
const net  = require('net')
const os   = require('os')
const path = require('path')
const fs   = require('fs')

const PKG_DIR    = path.join(__dirname, '..')
const SERVER_JS  = path.join(PKG_DIR, '.next', 'standalone', 'server.js')

// ANSI helpers — Claude's warm orange palette
const O   = '\x1b[38;5;208m'  // orange
const O2  = '\x1b[38;5;214m'  // amber
const DIM = '\x1b[2m'
const B   = '\x1b[1m'
const R   = '\x1b[0m'

// OSC 8 terminal hyperlink
function link(text, url) {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`
}

function printBanner() {
  const art = [
    `${O}${B} ██████╗ ██████╗     ██╗     ███████╗███╗   ██╗███████╗${R}`,
    `${O}${B}██╔════╝██╔════╝     ██║     ██╔════╝████╗  ██║██╔════╝${R}`,
    `${O2}${B}██║     ██║          ██║     █████╗  ██╔██╗ ██║███████╗${R}`,
    `${O2}${B}██║     ██║          ██║     ██╔══╝  ██║╚██╗██║╚════██║${R}`,
    `${O}${B}╚██████╗╚██████╗     ███████╗███████╗██║ ╚████║███████║${R}`,
    `${O}${B} ╚═════╝ ╚═════╝     ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝${R}`,
  ]

  const author = link(`${O2}Arindam${R}`, 'https://github.com/Arindam200')

  console.log()
  art.forEach((line) => console.log('  ' + line))
  console.log()
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude')
  console.log(`  ${B}${O}Claude Code Lens${R}   ${DIM}—  your ~/.claude/ at a glance${R}`)
  console.log(`  ${DIM}Made with ♥ by ${R}${author}`)
  console.log()
  console.log(`  ${DIM}Config dir:${R}  ${O2}${configDir}${R}`)
  if (process.env.CLAUDE_CONFIG_DIR) {
    console.log(`  ${DIM}             (from CLAUDE_CONFIG_DIR)${R}`)
  }
  console.log()
}

function findFreePort(port = 3000, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(findFreePort(port + 1, host)))
    server.listen(port, host, () => server.close(() => resolve(port)))
  })
}

function readVersion() {
  try {
    return require(path.join(PKG_DIR, 'package.json')).version
  } catch {
    return 'unknown'
  }
}

function printHelp() {
  console.log(`
  ${B}${O}cc-lens${R}  ${DIM}—  your ~/.claude/ at a glance${R}

  ${B}Usage${R}
    cc-lens [options]
    cc-lens push --to <hub-url> --name <your-name> [options]
    cc-lens digest [--days <n>] [--team]

  ${B}Options${R}
    --host <host>   Address to bind (default ${O2}127.0.0.1${R}, loopback only).
                    Set ${O2}0.0.0.0${R} to expose on your LAN. Env: ${O2}CC_LENS_HOST${R}.
    --port <port>   Port to listen on (default ${O2}3000${R}; auto-increments if
                    taken). Env: ${O2}PORT${R}.
    --help, -h      Show this help and exit.
    --version, -v   Print the version and exit.

  ${B}Note${R}
    ${DIM}The dashboard serves your private Claude Code history, so it binds to
    loopback by default. Override the host only if you understand the exposure.${R}
`)
}

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32'  ? `start "" "${url}"` :
                                    `xdg-open "${url}"`
  exec(cmd)
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++ }
      else args[key] = true
    } else {
      args._.push(a)
    }
  }
  return args
}

function requireStandaloneBuild() {
  if (!fs.existsSync(SERVER_JS)) {
    console.error(`  ${O}✗${R}  Standalone build not found at ${SERVER_JS}`)
    console.error(`     If you're running from a cloned repo, run ${B}npm run build:dist${R} first.`)
    process.exit(1)
  }
}

/** Boot the standalone server silently on a free loopback port. */
async function startSilentServer() {
  const port = await findFreePort(49500)
  const child = spawn(process.execPath, [SERVER_JS], {
    cwd: path.dirname(SERVER_JS),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
  })
  const url = `http://127.0.0.1:${port}`
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start within 30s')), 30_000)
    function check(d) {
      if (/Local:|ready|started server|listening on/i.test(d.toString())) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout.on('data', check)
    child.stderr.on('data', check)
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited early (code ${code})`)) })
  })
  return { child, url }
}

/** fetch with a deadline so a stalled endpoint can't hang the command forever
 *  (which would also keep the `finally { child.kill() }` cleanup from running). */
async function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`request to ${url} timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw new Error(`request to ${url} failed: ${err?.message ?? err}`)
  }
}

// cc-lens push --to <hub-url> --name <you> [--email x] [--machine x] [--titles] [--token x]
async function runPush(args) {
  printBanner()
  requireStandaloneBuild()

  const to = args.to
  const name = args.name
  if (!to || !name || typeof to !== 'string' || typeof name !== 'string') {
    console.error(`  ${O}✗${R}  Usage: ${B}cc-lens push --to <hub-url> --name <your-name>${R}`)
    console.error(`     Optional: ${DIM}--email <email> --machine <label> --titles --token <shared-token>${R}`)
    process.exit(1)
  }
  const token = (typeof args.token === 'string' && args.token) || process.env.CC_LENS_TEAM_TOKEN

  console.log(`  ${DIM}Reading ~/.claude and building a redacted team export…${R}`)
  const { child, url } = await startSilentServer()
  try {
    const exportRes = await fetchWithTimeout(`${url}/api/export/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberName: name,
        ...(typeof args.email === 'string' ? { memberEmail: args.email } : {}),
        ...(typeof args.machine === 'string' ? { machine: args.machine } : {}),
        redaction: args.titles ? 'titles' : 'metrics',
      }),
    })
    if (!exportRes.ok) throw new Error(`local export failed (${exportRes.status}): ${await exportRes.text()}`)
    const payload = await exportRes.json()

    const hubUrl = to.replace(/\/$/, '')
    console.log(`  ${DIM}Pushing ${payload.sessions.length} sessions to${R} ${O2}${hubUrl}${R}`)
    const pushRes = await fetchWithTimeout(`${hubUrl}/api/team/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    if (!pushRes.ok) throw new Error(`hub rejected push (${pushRes.status}): ${await pushRes.text()}`)
    const result = await pushRes.json()
    console.log(`\n  ${O}✓${R}  Pushed ${B}${result.sessions}${R} sessions as ${B}${result.member}${R} (${result.stored_as})`)
    console.log(`  ${DIM}Redaction: ${args.titles ? 'titles (first prompts included)' : 'metrics only'}${R}\n`)
  } finally {
    child.kill()
  }
}

// cc-lens digest [--days 7] [--team]
// Prints a formatted spend digest in the terminal. Slack/webhook alerts are
// a managed-version feature and intentionally absent from the npm package.
async function runDigest(args) {
  printBanner()
  requireStandaloneBuild()

  const days = Number(args.days) >= 1 ? Math.floor(Number(args.days)) : 7
  const scope = args.team ? 'team' : 'local'

  console.log(`  ${DIM}Building ${scope} digest for the last ${days} days…${R}`)
  const { child, url } = await startSilentServer()
  let digest
  try {
    const res = await fetchWithTimeout(`${url}/api/digest?days=${days}&scope=${scope}`)
    if (!res.ok) throw new Error(`digest failed (${res.status}): ${await res.text()}`)
    digest = await res.json()
  } finally {
    child.kill()
  }

  const usd = (n) => `$${n < 10 && n > 0 ? n.toFixed(2) : Math.round(n).toLocaleString()}`
  const row = (label, value) => console.log(`  ${DIM}${label.padEnd(14)}${R}${value}`)

  const deltaPct = digest.prev_cost > 0
    ? Math.round(((digest.total_cost - digest.prev_cost) / digest.prev_cost) * 100)
    : null
  const delta = deltaPct === null ? ''
    : deltaPct >= 0
      ? `   ${O}▲ ${deltaPct}%${R} ${DIM}vs prior ${digest.period_days} days${R}`
      : `   ${O2}▼ ${-deltaPct}%${R} ${DIM}vs prior ${digest.period_days} days${R}`

  console.log()
  console.log(`  ${B}${O}Claude Code digest${R}  ${DIM}—  last ${digest.period_days} days${scope === 'team' ? ' (team)' : ''}, since ${digest.since}${R}`)
  console.log()
  row('Spend', `${B}${usd(digest.total_cost)}${R}${delta}`)
  row('Sessions', `${digest.sessions}`)
  if (typeof digest.cache_hit_rate === 'number') {
    row('Cache hits', `${Math.round(digest.cache_hit_rate * 100)}%`)
  }
  if (digest.top.length > 0) {
    const label = scope === 'team' ? 'Top members' : 'Top projects'
    row(label, digest.top.map((t) => `${t.name} ${DIM}(${usd(t.cost)})${R}`).join(', '))
  }
  if (digest.potential_monthly_savings > 1) {
    row('Savings', `~${usd(digest.potential_monthly_savings)}/mo potential ${DIM}— see the Insights page${R}`)
  }
  if (digest.budget) {
    const pct = Math.round((digest.budget.month_to_date_cost / digest.budget.monthly_budget_usd) * 100)
    row('Budget', `${usd(digest.budget.month_to_date_cost)} of ${usd(digest.budget.monthly_budget_usd)} used ${DIM}(${pct}%)${R}`)
  }
  for (const a of digest.anomalies ?? []) {
    console.log(`  ${O}⚠${R}  Spend spike on ${B}${a.date}${R}: ${usd(a.cost)} vs ${usd(a.baseline)} daily median`)
  }
  console.log()
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) { printHelp(); return }
  if (argv.includes('--version') || argv.includes('-v')) { console.log(readVersion()); return }

  const args = parseArgs(argv)
  if (args._[0] === 'push') {
    await runPush(args)
    return
  }
  if (args._[0] === 'digest') {
    await runDigest(args)
    return
  }

  printBanner()
  requireStandaloneBuild()

  // Bind to loopback only by default — this server exposes private Claude
  // history. Opt into LAN access with `--host 0.0.0.0` or CC_LENS_HOST.
  // We intentionally do NOT read $HOSTNAME: many shells and containers export
  // it as the machine name, which both breaks http://localhost and can bind
  // wider than intended (issue #21).
  const hostname = (typeof args.host === 'string' && args.host) || process.env.CC_LENS_HOST || '127.0.0.1'
  const port     = await findFreePort(Number(args.port ?? process.env.PORT) || 3000, hostname)
  const url      = `http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`

  console.log(`  ${DIM}Starting server on${R} ${O2}${B}${url}${R}\n`)

  const child = spawn(process.execPath, [SERVER_JS], {
    cwd: path.dirname(SERVER_JS),
    stdio: [process.platform === 'win32' ? 'ignore' : 'inherit', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), HOSTNAME: hostname, NODE_ENV: 'production' },
  })

  let opened = false
  function checkReady(text) {
    if (!opened && /Local:|ready|started server|listening on/i.test(text)) {
      opened = true
      console.log(`\n  ${O}✓${R}  Opening ${B}${url}${R} in your browser…\n`)
      openBrowser(url)
    }
  }

  child.stdout.on('data', (d) => { process.stdout.write(d); checkReady(d.toString()) })
  child.stderr.on('data', (d) => { process.stderr.write(d); checkReady(d.toString()) })

  child.on('exit', (code) => process.exit(code ?? 0))

  process.on('SIGINT',  () => { child.kill(); process.exit(0) })
  process.on('SIGTERM', () => { child.kill(); process.exit(0) })
}

main().catch((err) => { console.error(err); process.exit(1) })
