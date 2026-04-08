import { describe, it, expect } from 'vitest'
import type { MemoryFileInfo, MemoryConfig, MemoryStatus, MemoryStats, MemoryHealthSummary, MemoryHealthCheck } from './types'
import { buildMemoryHealthPrompt, buildCheckFixPrompt } from './memory-health-prompt'

// ── Factories ────────────────────────────────────────────────

function makeFile(overrides: Partial<MemoryFileInfo> = {}): MemoryFileInfo {
  return {
    label: 'Test File',
    path: '/ws/memory/test.md',
    relativePath: 'memory/test.md',
    content: '# Test\nSome content.',
    lastModified: '2026-03-01T12:00:00Z',
    sizeBytes: 500,
    category: 'evergreen',
    ...overrides,
  }
}

function makeMemoryMd(lineCount: number): MemoryFileInfo {
  const content = Array(lineCount).fill('Line of content').join('\n')
  return makeFile({
    label: 'Long-Term Memory',
    path: '/ws/MEMORY.md',
    relativePath: 'MEMORY.md',
    content,
    sizeBytes: content.length,
    category: 'evergreen',
  })
}

function makeConfig(overrides: Partial<MemoryConfig> = {}): MemoryConfig {
  return {
    memorySearch: {
      enabled: false,
      provider: null,
      model: null,
      hybrid: {
        enabled: true,
        vectorWeight: 0.7,
        textWeight: 0.3,
        temporalDecay: { enabled: true, halfLifeDays: 30 },
        mmr: { enabled: true, lambda: 0.7 },
      },
      cache: { enabled: true, maxEntries: 256 },
      extraPaths: [],
    },
    memoryFlush: { enabled: false, softThresholdTokens: 80000 },
    configFound: true,
    ...overrides,
  }
}

function makeStatus(overrides: Partial<MemoryStatus> = {}): MemoryStatus {
  return {
    indexed: false,
    lastIndexed: null,
    totalEntries: null,
    vectorAvailable: null,
    embeddingProvider: null,
    raw: '',
    ...overrides,
  }
}

function makeStats(overrides: Partial<MemoryStats> = {}): MemoryStats {
  return {
    totalFiles: 3,
    totalSizeBytes: 1500,
    dailyLogCount: 1,
    evergreenCount: 2,
    oldestDaily: '2026-02-01',
    newestDaily: '2026-03-01',
    dailyTimeline: [],
    ...overrides,
  }
}

function makeHealth(overrides: Partial<MemoryHealthSummary> = {}): MemoryHealthSummary {
  return {
    score: 100,
    checks: [],
    staleDailyLogs: [],
    ...overrides,
  }
}

function makeCheck(overrides: Partial<MemoryHealthCheck> = {}): MemoryHealthCheck {
  return {
    id: 'test-check',
    severity: 'warning',
    title: 'Test check title',
    description: 'Test check description',
    affectedFiles: null,
    action: 'Fix it',
    ...overrides,
  }
}

// ── buildMemoryHealthPrompt ─────────────────────────────────

describe('buildMemoryHealthPrompt', () => {
  const files = [makeFile(), makeMemoryMd(50)]
  const config = makeConfig()
  const status = makeStatus()
  const stats = makeStats()

  it('includes role and best practices sections', () => {
    const health = makeHealth()
    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health)
    expect(prompt).toContain('memory system advisor')
    expect(prompt).toContain('Best Practices')
    expect(prompt).toContain('200')
  })

  it('includes file listing', () => {
    const health = makeHealth()
    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health)
    expect(prompt).toContain('memory/test.md')
    expect(prompt).toContain('MEMORY.md')
  })

  it('includes active health checks when present', () => {
    const health = makeHealth({
      checks: [makeCheck({ id: 'file-size', severity: 'critical', title: 'File too big' })],
    })
    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health)
    expect(prompt).toContain('[CRITICAL]')
    expect(prompt).toContain('File too big')
  })

  it('shows no issues when checks are empty', () => {
    const health = makeHealth({ checks: [] })
    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health)
    expect(prompt).toContain('No issues detected')
  })

  it('includes stale daily log details when present', () => {
    const health = makeHealth({
      staleDailyLogs: [
        { relativePath: 'memory/2025-12-01.md', label: 'Daily Log', date: '2025-12-01', ageDays: 90, sizeBytes: 1200 },
      ],
    })
    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health)
    expect(prompt).toContain('2025-12-01')
    expect(prompt).toContain('90 days old')
  })

  it('includes config snapshot', () => {
    const prompt = buildMemoryHealthPrompt(files, config, status, stats, makeHealth())
    expect(prompt).toContain('Vector search: disabled')
    expect(prompt).toContain('Temporal decay: enabled')
    expect(prompt).toContain('Cache: enabled')
  })

  it('includes index status', () => {
    const s = makeStatus({ indexed: true, lastIndexed: '2026-03-01T10:00:00Z', totalEntries: 42 })
    const prompt = buildMemoryHealthPrompt(files, config, s, stats, makeHealth())
    expect(prompt).toContain('Indexed: yes')
    expect(prompt).toContain('Total entries: 42')
  })

  it('includes health score and file counts', () => {
    const health = makeHealth({ score: 77 })
    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health)
    expect(prompt).toContain('Health score: 77/100')
    expect(prompt).toContain('Total files: 3')
  })
})

// ── buildCheckFixPrompt ─────────────────────────────────────

describe('buildCheckFixPrompt', () => {
  const files = [makeFile(), makeMemoryMd(250)]

  it('returns MEMORY.md content for memory-md-lines check', () => {
    const check = makeCheck({ id: 'memory-md-lines', affectedFiles: ['MEMORY.md'] })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('250 lines')
    expect(prompt).toContain('200')
    expect(prompt).toContain('Line of content')
  })

  it('returns file details for file-size check', () => {
    const bigFile = makeFile({ relativePath: 'big.md', sizeBytes: 120 * 1024 })
    const check = makeCheck({ id: 'file-size', affectedFiles: ['big.md'] })
    const prompt = buildCheckFixPrompt(check, [bigFile])
    expect(prompt).toContain('big.md')
    expect(prompt).toContain('120.0KB')
  })

  it('returns stale log guidance for stale-daily-logs check', () => {
    const check = makeCheck({ id: 'stale-daily-logs', affectedFiles: ['memory/2025-12-01.md'] })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('stale')
    expect(prompt).toContain('temporal decay')
  })

  it('returns size breakdown for total-size check', () => {
    const check = makeCheck({ id: 'total-size', affectedFiles: null })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('Total memory size')
    expect(prompt).toContain('prune')
  })

  it('returns reindex explanation for unindexed-vector check', () => {
    const check = makeCheck({ id: 'unindexed-vector', affectedFiles: null })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('Vector search is enabled')
    expect(prompt).toContain('reindex')
  })

  it('lists changed files for stale-index check', () => {
    const check = makeCheck({ id: 'stale-index', affectedFiles: ['memory/test.md'] })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('memory/test.md')
    expect(prompt).toContain('stale')
  })

  it('returns review checklist for stale-evergreen check', () => {
    const check = makeCheck({ id: 'stale-evergreen', affectedFiles: ['memory/test.md'] })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('90+ days')
    expect(prompt).toContain('review checklist')
  })

  it('shows example config for no-config check', () => {
    const check = makeCheck({ id: 'no-config', affectedFiles: null })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('memorySearch')
    expect(prompt).toContain('openclaw.json')
  })

  it('explains trade-offs for decay-disabled check', () => {
    const check = makeCheck({ id: 'decay-disabled', affectedFiles: null })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('Temporal decay')
    expect(prompt).toContain('trade-off')
  })

  it('handles unknown check ID gracefully', () => {
    const check = makeCheck({ id: 'unknown-thing', title: 'Mystery issue' })
    const prompt = buildCheckFixPrompt(check, files)
    expect(prompt).toContain('Mystery issue')
    expect(prompt).toContain('suggest specific actions')
  })
})
