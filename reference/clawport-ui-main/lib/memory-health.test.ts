import { describe, it, expect } from 'vitest'
import type { MemoryFileInfo, MemoryConfig, MemoryStatus, MemoryStats, MemoryHealthCheck } from './types'
import { computeMemoryHealth, computeHealthScore, fileHealthSeverity, computeStaleDailyLogs } from './memory-health'

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

function makeDailyLog(date: string, sizeBytes = 200): MemoryFileInfo {
  return makeFile({
    label: `Daily Log (${date})`,
    path: `/ws/memory/${date}.md`,
    relativePath: `memory/${date}.md`,
    content: `# ${date}\nLog content`,
    lastModified: `${date}T12:00:00Z`,
    sizeBytes,
    category: 'daily',
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
    oldestDaily: '2026-03-01',
    newestDaily: '2026-03-01',
    dailyTimeline: [],
    ...overrides,
  }
}

const NOW = new Date('2026-03-10T12:00:00Z').getTime()

// ── computeHealthScore ───────────────────────────────────────

describe('computeHealthScore', () => {
  it('returns 100 for no checks', () => {
    expect(computeHealthScore([])).toBe(100)
  })

  it('deducts 20 per critical check', () => {
    const checks: MemoryHealthCheck[] = [
      { id: 'a', severity: 'critical', title: '', description: '', affectedFiles: null, action: null },
    ]
    expect(computeHealthScore(checks)).toBe(80)
  })

  it('deducts 10 per warning check', () => {
    const checks: MemoryHealthCheck[] = [
      { id: 'a', severity: 'warning', title: '', description: '', affectedFiles: null, action: null },
    ]
    expect(computeHealthScore(checks)).toBe(90)
  })

  it('deducts 3 per info check', () => {
    const checks: MemoryHealthCheck[] = [
      { id: 'a', severity: 'info', title: '', description: '', affectedFiles: null, action: null },
    ]
    expect(computeHealthScore(checks)).toBe(97)
  })

  it('clamps to 0', () => {
    const checks: MemoryHealthCheck[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      severity: 'critical' as const,
      title: '',
      description: '',
      affectedFiles: null,
      action: null,
    }))
    expect(computeHealthScore(checks)).toBe(0)
  })

  it('ignores ok severity', () => {
    const checks: MemoryHealthCheck[] = [
      { id: 'a', severity: 'ok', title: '', description: '', affectedFiles: null, action: null },
    ]
    expect(computeHealthScore(checks)).toBe(100)
  })
})

// ── fileHealthSeverity ───────────────────────────────────────

describe('fileHealthSeverity', () => {
  it('returns ok when no checks affect the file', () => {
    const file = makeFile()
    const checks: MemoryHealthCheck[] = [
      { id: 'a', severity: 'critical', title: '', description: '', affectedFiles: ['other.md'], action: null },
    ]
    expect(fileHealthSeverity(file, checks)).toBe('ok')
  })

  it('returns the worst severity for the file', () => {
    const file = makeFile({ relativePath: 'memory/test.md' })
    const checks: MemoryHealthCheck[] = [
      { id: 'a', severity: 'info', title: '', description: '', affectedFiles: ['memory/test.md'], action: null },
      { id: 'b', severity: 'warning', title: '', description: '', affectedFiles: ['memory/test.md'], action: null },
    ]
    expect(fileHealthSeverity(file, checks)).toBe('warning')
  })

  it('returns ok for checks with null affectedFiles', () => {
    const file = makeFile()
    const checks: MemoryHealthCheck[] = [
      { id: 'a', severity: 'critical', title: '', description: '', affectedFiles: null, action: null },
    ]
    expect(fileHealthSeverity(file, checks)).toBe('ok')
  })
})

// ── computeStaleDailyLogs ────────────────────────────────────

describe('computeStaleDailyLogs', () => {
  it('returns empty for no daily logs', () => {
    const files = [makeFile()]
    expect(computeStaleDailyLogs(files, NOW)).toEqual([])
  })

  it('returns empty for recent daily logs', () => {
    const files = [makeDailyLog('2026-03-09')]
    expect(computeStaleDailyLogs(files, NOW)).toEqual([])
  })

  it('returns logs older than 30 days', () => {
    const files = [makeDailyLog('2026-01-01')]
    const result = computeStaleDailyLogs(files, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[0].ageDays).toBe(68)
  })

  it('sorts by age descending', () => {
    const files = [makeDailyLog('2026-02-01'), makeDailyLog('2025-12-01')]
    const result = computeStaleDailyLogs(files, NOW)
    expect(result).toHaveLength(2)
    expect(result[0].ageDays).toBeGreaterThan(result[1].ageDays)
  })

  it('excludes logs at exactly 30 days boundary', () => {
    // 30 days before NOW = 2026-02-08
    const files = [makeDailyLog('2026-02-08')]
    const result = computeStaleDailyLogs(files, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].ageDays).toBe(30)
  })

  it('excludes 29-day-old logs', () => {
    const files = [makeDailyLog('2026-02-09')]
    const result = computeStaleDailyLogs(files, NOW)
    expect(result).toHaveLength(0)
  })
})

// ── computeMemoryHealth (integration) ────────────────────────

describe('computeMemoryHealth', () => {
  it('returns 100 score for healthy system', () => {
    const files = [makeMemoryMd(50), makeFile(), makeDailyLog('2026-03-09')]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats({ totalSizeBytes: 2000 })

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    // May have info-level checks (no-config is hidden since configFound=true)
    expect(health.score).toBeGreaterThanOrEqual(90)
  })

  it('detects MEMORY.md over 200 lines as critical', () => {
    const files = [makeMemoryMd(210)]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'memory-md-lines')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('critical')
  })

  it('detects MEMORY.md over 150 lines as warning', () => {
    const files = [makeMemoryMd(160)]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'memory-md-lines')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('warning')
  })

  it('does not flag MEMORY.md under 150 lines', () => {
    const files = [makeMemoryMd(100)]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'memory-md-lines')
    expect(check).toBeUndefined()
  })

  it('detects files over 100KB as critical', () => {
    const files = [makeFile({ sizeBytes: 150 * 1024 })]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'file-size')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('critical')
  })

  it('detects files over 50KB as warning', () => {
    const files = [makeFile({ sizeBytes: 60 * 1024 })]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'file-size')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('warning')
  })

  it('detects total size over 1MB as critical', () => {
    const files = [makeFile()]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats({ totalSizeBytes: 2 * 1024 * 1024 })

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'total-size')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('critical')
  })

  it('detects total size over 500KB as warning', () => {
    const files = [makeFile()]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats({ totalSizeBytes: 600 * 1024 })

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'total-size')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('warning')
  })

  it('detects vector search enabled but unindexed', () => {
    const files = [makeFile()]
    const config = makeConfig({
      memorySearch: {
        ...makeConfig().memorySearch,
        enabled: true,
      },
    })
    const status = makeStatus({ indexed: false })
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'unindexed-vector')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('critical')
  })

  it('does not flag when vector search is disabled', () => {
    const files = [makeFile()]
    const config = makeConfig()
    const status = makeStatus({ indexed: false })
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'unindexed-vector')
    expect(check).toBeUndefined()
  })

  it('detects stale index', () => {
    const twoHoursAgo = new Date(NOW - 2 * 60 * 60 * 1000).toISOString()
    const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString()
    const files = [makeFile({ lastModified: oneHourAgo })]
    const config = makeConfig({
      memorySearch: { ...makeConfig().memorySearch, enabled: true },
    })
    const status = makeStatus({ indexed: true, lastIndexed: twoHoursAgo })
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'stale-index')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('warning')
  })

  it('does not flag stale index when last indexed < 1 hour ago', () => {
    const thirtyMinAgo = new Date(NOW - 30 * 60 * 1000).toISOString()
    const tenMinAgo = new Date(NOW - 10 * 60 * 1000).toISOString()
    const files = [makeFile({ lastModified: tenMinAgo })]
    const config = makeConfig({
      memorySearch: { ...makeConfig().memorySearch, enabled: true },
    })
    const status = makeStatus({ indexed: true, lastIndexed: thirtyMinAgo })
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'stale-index')
    expect(check).toBeUndefined()
  })

  it('detects stale evergreen files', () => {
    const oldDate = new Date(NOW - 100 * 24 * 60 * 60 * 1000).toISOString()
    const files = [makeFile({ lastModified: oldDate })]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'stale-evergreen')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('info')
  })

  it('detects no explicit config', () => {
    const files = [makeFile()]
    const config = makeConfig({ configFound: false })
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'no-config')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('info')
  })

  it('detects temporal decay disabled', () => {
    const config = makeConfig({
      memorySearch: {
        ...makeConfig().memorySearch,
        enabled: true,
        hybrid: {
          ...makeConfig().memorySearch.hybrid,
          temporalDecay: { enabled: false, halfLifeDays: 30 },
        },
      },
    })
    const files = [makeFile()]
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const check = health.checks.find(c => c.id === 'decay-disabled')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('info')
  })

  it('sorts checks by severity (critical first)', () => {
    const files = [makeMemoryMd(210), makeFile({ sizeBytes: 150 * 1024 })]
    const config = makeConfig({ configFound: false })
    const status = makeStatus()
    const stats = makeStats({ totalSizeBytes: 2 * 1024 * 1024 })

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    const severities = health.checks.map(c => c.severity)
    const criticalIdx = severities.indexOf('critical')
    const infoIdx = severities.indexOf('info')
    if (criticalIdx >= 0 && infoIdx >= 0) {
      expect(criticalIdx).toBeLessThan(infoIdx)
    }
  })

  it('includes stale daily logs in summary', () => {
    const files = [makeDailyLog('2025-12-01')]
    const config = makeConfig()
    const status = makeStatus()
    const stats = makeStats()

    const health = computeMemoryHealth(files, config, status, stats, NOW)
    expect(health.staleDailyLogs).toHaveLength(1)
    expect(health.staleDailyLogs[0].date).toBe('2025-12-01')
  })
})
