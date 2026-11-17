import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

describe('reader: branches, history tail, snapshot', () => {
  let dir: string
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclens-hard-'))
    process.env.CLAUDE_CONFIG_DIR = dir
    const proj = path.join(dir, 'projects', '-tmp-demo')
    await fs.mkdir(proj, { recursive: true })
    const lines = [
      { type: 'user', timestamp: '2026-01-01T00:00:00Z', cwd: '/tmp/demo', gitBranch: 'main', message: { content: 'hi' } },
      { type: 'user', timestamp: '2026-01-01T00:01:00Z', gitBranch: 'feat/x', message: { content: 'yo' } },
      { type: 'user', timestamp: '2026-01-01T00:02:00Z', gitBranch: 'HEAD', message: { content: 'z' } },
    ]
    await fs.writeFile(path.join(proj, 's1.jsonl'), lines.map(l => JSON.stringify(l)).join('\n'))
    const hist = Array.from({ length: 1000 }, (_, i) => JSON.stringify({ display: `cmd${i}`, timestamp: i, project: 'p' }))
    await fs.writeFile(path.join(dir, 'history.jsonl'), hist.join('\n') + '\n')
  })
  afterAll(async () => { await fs.rm(dir, { recursive: true, force: true }) })

  it('collects all distinct non-HEAD branches in one parse', async () => {
    const reader = await import('@/lib/claude-reader')
    const [s] = await reader.getAllParsedSessions()
    expect(s.git_branches?.sort()).toEqual(['feat/x', 'main'])
    expect(s.project_slug).toBe('-tmp-demo')
  })

  it('readHistory returns exactly the last N rows in order', async () => {
    const reader = await import('@/lib/claude-reader')
    const h = await reader.readHistory(5)
    expect(h.map(e => e.display)).toEqual(['cmd995', 'cmd996', 'cmd997', 'cmd998', 'cmd999'])
    expect((await reader.readHistory(5000)).length).toBe(1000)
  })

  it('concurrent snapshot callers share one scan', async () => {
    const reader = await import('@/lib/claude-reader')
    reader.invalidateSessionSnapshot()
    const [a, b] = await Promise.all([reader.getSessionSnapshot(), reader.getSessionSnapshot()])
    expect(a).toBe(b)
  })
})

describe('persistent parse cache', () => {
  it('reuses parsed sessions from disk after a simulated restart', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclens-disk-'))
    const cfg = await fs.mkdtemp(path.join(os.tmpdir(), 'cclens-cfg-'))
    const prev = { c: process.env.CLAUDE_CONFIG_DIR, n: process.env.CC_LENS_NO_DISK_CACHE, k: process.env.CC_LENS_CONFIG_DIR }
    process.env.CLAUDE_CONFIG_DIR = dir
    process.env.CC_LENS_CONFIG_DIR = cfg
    delete process.env.CC_LENS_NO_DISK_CACHE
    try {
      const proj = path.join(dir, 'projects', '-x')
      await fs.mkdir(proj, { recursive: true })
      const f = path.join(proj, 's.jsonl')
      await fs.writeFile(f, JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:00:00Z', cwd: '/x', message: { content: 'hello' } }))
      const reader = await import('@/lib/claude-reader')
      reader.resetSessionCachesForTests()
      const [a] = await reader.getAllParsedSessions()
      await reader.flushSessionDiskCache()
      expect(a.first_prompt).toBe('hello')
      // Tamper with the cached copy: a restart that hits the cache must return it unparsed
      const cacheFile = path.join(cfg, 'cache', 'sessions.json')
      const raw = JSON.parse(await fs.readFile(cacheFile, 'utf-8'))
      raw.entries[f].session.first_prompt = 'FROM-DISK'
      await fs.writeFile(cacheFile, JSON.stringify(raw))
      reader.resetSessionCachesForTests()
      const [b] = await reader.getAllParsedSessions()
      expect(b.first_prompt).toBe('FROM-DISK')
      // Touching the file invalidates the entry
      await fs.appendFile(f, '\n' + JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:01:00Z', message: { content: 'again' } }))
      reader.resetSessionCachesForTests()
      const [c] = await reader.getAllParsedSessions()
      expect(c.first_prompt).toBe('hello')
    } finally {
      process.env.CC_LENS_NO_DISK_CACHE = prev.n ?? '1'
      process.env.CLAUDE_CONFIG_DIR = prev.c
      if (prev.k === undefined) delete process.env.CC_LENS_CONFIG_DIR; else process.env.CC_LENS_CONFIG_DIR = prev.k
      await fs.rm(dir, { recursive: true, force: true }); await fs.rm(cfg, { recursive: true, force: true })
    }
  })
})
