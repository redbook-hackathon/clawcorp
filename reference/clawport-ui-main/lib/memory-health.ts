import type {
  MemoryFileInfo,
  MemoryConfig,
  MemoryStatus,
  MemoryStats,
  MemoryHealthCheck,
  MemoryHealthSummary,
  StaleDailyLogInfo,
  HealthSeverity,
} from '@/lib/types'

// No Node imports -- this module is used from both server and client code.
// Use relativePath (already available on MemoryFileInfo) instead of path.basename().

// ── Constants ────────────────────────────────────────────────

const DAILY_PATTERN = /^\d{4}-\d{2}-\d{2}\.md$/

const SEVERITY_DEDUCTIONS: Record<Exclude<HealthSeverity, 'ok'>, number> = {
  critical: 20,
  warning: 10,
  info: 3,
}

// ── Stale daily log helper ───────────────────────────────────

export function computeStaleDailyLogs(files: MemoryFileInfo[], now = Date.now()): StaleDailyLogInfo[] {
  const results: StaleDailyLogInfo[] = []
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  for (const file of files) {
    if (file.category !== 'daily') continue
    const filename = file.relativePath.split('/').pop() ?? ''
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
    if (!match) continue

    const dateStr = match[1]
    const fileDate = new Date(dateStr + 'T00:00:00Z').getTime()
    if (isNaN(fileDate)) continue

    const ageDays = Math.floor((now - fileDate) / (24 * 60 * 60 * 1000))
    if (ageDays < 30) continue

    results.push({
      relativePath: file.relativePath,
      label: file.label,
      date: dateStr,
      ageDays,
      sizeBytes: file.sizeBytes,
    })
  }

  // Sort by age descending (oldest first)
  return results.sort((a, b) => b.ageDays - a.ageDays)
}

// ── Health score ─────────────────────────────────────────────

export function computeHealthScore(checks: MemoryHealthCheck[]): number {
  let score = 100
  for (const check of checks) {
    if (check.severity !== 'ok') {
      score -= SEVERITY_DEDUCTIONS[check.severity]
    }
  }
  return Math.max(0, Math.min(100, score))
}

// ── Per-file severity ────────────────────────────────────────

const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  ok: 3,
}

export function fileHealthSeverity(
  file: MemoryFileInfo,
  checks: MemoryHealthCheck[]
): HealthSeverity {
  let worst: HealthSeverity = 'ok'

  for (const check of checks) {
    if (!check.affectedFiles) continue
    if (!check.affectedFiles.includes(file.relativePath)) continue
    if (SEVERITY_ORDER[check.severity] < SEVERITY_ORDER[worst]) {
      worst = check.severity
    }
  }

  return worst
}

// ── Health checks ────────────────────────────────────────────

function findMemoryMd(files: MemoryFileInfo[]): MemoryFileInfo | undefined {
  return files.find(f => f.relativePath === 'MEMORY.md')
}

function checkMemoryMdLineCount(files: MemoryFileInfo[]): MemoryHealthCheck | null {
  const memoryMd = findMemoryMd(files)
  if (!memoryMd) return null

  const lineCount = memoryMd.content.split('\n').length

  if (lineCount > 200) {
    return {
      id: 'memory-md-lines',
      severity: 'critical',
      title: 'MEMORY.md exceeds 200 lines',
      description: `MEMORY.md has ${lineCount} lines. Lines after 200 are truncated when loaded into agent context. Split into topic files and link from MEMORY.md.`,
      affectedFiles: ['MEMORY.md'],
      action: 'Split MEMORY.md into topic files (e.g., patterns.md, debugging.md) and link from MEMORY.md.',
    }
  }

  if (lineCount > 150) {
    return {
      id: 'memory-md-lines',
      severity: 'warning',
      title: 'MEMORY.md approaching 200 line limit',
      description: `MEMORY.md has ${lineCount} lines. Best practice is to keep it under 200 lines. Consider splitting less-critical sections into separate files.`,
      affectedFiles: ['MEMORY.md'],
      action: 'Move detailed sections into separate topic files to keep MEMORY.md concise.',
    }
  }

  return null
}

function checkFileSizes(files: MemoryFileInfo[]): MemoryHealthCheck | null {
  const critical: string[] = []
  const warning: string[] = []

  for (const file of files) {
    if (file.sizeBytes > 100 * 1024) {
      critical.push(file.relativePath)
    } else if (file.sizeBytes > 50 * 1024) {
      warning.push(file.relativePath)
    }
  }

  if (critical.length > 0) {
    return {
      id: 'file-size',
      severity: 'critical',
      title: `${critical.length} file${critical.length > 1 ? 's' : ''} over 100KB`,
      description: 'Large memory files dilute retrieval quality. Chunk-based search works best with focused, well-structured files under 50KB.',
      affectedFiles: critical,
      action: 'Split large files into smaller, focused topic files.',
    }
  }

  if (warning.length > 0) {
    return {
      id: 'file-size',
      severity: 'warning',
      title: `${warning.length} file${warning.length > 1 ? 's' : ''} over 50KB`,
      description: 'Files approaching the 100KB threshold. Consider splitting to improve search precision.',
      affectedFiles: warning,
      action: 'Review large files and split if they cover multiple distinct topics.',
    }
  }

  return null
}

function checkStaleDailyLogs(files: MemoryFileInfo[], now: number): MemoryHealthCheck | null {
  const stale = computeStaleDailyLogs(files, now)
  if (stale.length === 0) return null

  const over60 = stale.filter(s => s.ageDays > 60)
  const affected = stale.map(s => s.relativePath)

  if (over60.length > 0) {
    return {
      id: 'stale-daily-logs',
      severity: 'warning',
      title: `${stale.length} stale daily log${stale.length > 1 ? 's' : ''}`,
      description: `${over60.length} log${over60.length > 1 ? 's are' : ' is'} over 60 days old. Old logs add noise to search results and slow retrieval.`,
      affectedFiles: affected,
      action: 'Review old daily logs: promote useful patterns to evergreen files, then delete stale logs.',
    }
  }

  return {
    id: 'stale-daily-logs',
    severity: 'info',
    title: `${stale.length} daily log${stale.length > 1 ? 's' : ''} over 30 days old`,
    description: 'Consider reviewing older daily logs for patterns worth promoting to evergreen files.',
    affectedFiles: affected,
    action: 'Review daily logs older than 30 days and archive or promote useful content.',
  }
}

function checkTotalMemorySize(stats: MemoryStats): MemoryHealthCheck | null {
  const totalBytes = stats.totalSizeBytes

  if (totalBytes > 1024 * 1024) {
    return {
      id: 'total-size',
      severity: 'critical',
      title: 'Total memory exceeds 1MB',
      description: `Total memory size is ${(totalBytes / 1024 / 1024).toFixed(1)}MB. Large memory stores degrade search quality and increase embedding costs.`,
      affectedFiles: null,
      action: 'Prune old daily logs and split or trim oversized files.',
    }
  }

  if (totalBytes > 500 * 1024) {
    return {
      id: 'total-size',
      severity: 'warning',
      title: 'Total memory approaching 1MB',
      description: `Total memory size is ${(totalBytes / 1024).toFixed(0)}KB. Consider pruning to keep retrieval fast and relevant.`,
      affectedFiles: null,
      action: 'Review and prune low-value content to stay under 500KB.',
    }
  }

  return null
}

function checkVectorSearchDisabled(config: MemoryConfig): MemoryHealthCheck | null {
  if (config.memorySearch.enabled) return null

  return {
    id: 'vector-search-disabled',
    severity: 'warning',
    title: 'Vector search is disabled',
    description: 'Agents can only read MEMORY.md directly. Enable vector search in openclaw.json so agents can semantically search all memory files.',
    affectedFiles: null,
    action: 'Enable memorySearch in openclaw.json and run "openclaw memory reindex" to build the search index.',
  }
}

function checkUnindexedVectorSearch(config: MemoryConfig, status: MemoryStatus): MemoryHealthCheck | null {
  if (!config.memorySearch.enabled) return null
  if (status.indexed) return null

  return {
    id: 'unindexed-vector',
    severity: 'critical',
    title: 'Vector search enabled but not indexed',
    description: 'Memory search is enabled in config but no index exists. Agents cannot use semantic search until the index is built.',
    affectedFiles: null,
    action: 'Run "openclaw memory reindex" to build the search index.',
  }
}

function checkStaleIndex(
  config: MemoryConfig,
  status: MemoryStatus,
  files: MemoryFileInfo[],
  now: number
): MemoryHealthCheck | null {
  if (!config.memorySearch.enabled) return null
  if (!status.indexed || !status.lastIndexed) return null

  const lastIndexedMs = new Date(status.lastIndexed).getTime()
  if (isNaN(lastIndexedMs)) return null

  // Check if any file was modified after the last index
  const modifiedAfterIndex = files.filter(f => {
    const mtime = new Date(f.lastModified).getTime()
    return mtime > lastIndexedMs
  })

  if (modifiedAfterIndex.length === 0) return null

  const hoursSinceIndex = (now - lastIndexedMs) / (60 * 60 * 1000)
  if (hoursSinceIndex < 1) return null

  return {
    id: 'stale-index',
    severity: 'warning',
    title: 'Search index is stale',
    description: `${modifiedAfterIndex.length} file${modifiedAfterIndex.length > 1 ? 's were' : ' was'} modified after the last index (${Math.floor(hoursSinceIndex)}h ago). Agents may miss recent edits.`,
    affectedFiles: modifiedAfterIndex.map(f => f.relativePath),
    action: 'Reindex memory so agents see your latest changes.',
  }
}

function checkStaleEvergreenFiles(files: MemoryFileInfo[], now: number): MemoryHealthCheck | null {
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000
  const stale = files.filter(f => {
    if (f.category !== 'evergreen') return false
    const mtime = new Date(f.lastModified).getTime()
    return mtime < ninetyDaysAgo
  })

  if (stale.length === 0) return null

  return {
    id: 'stale-evergreen',
    severity: 'info',
    title: `${stale.length} evergreen file${stale.length > 1 ? 's' : ''} not updated in 90+ days`,
    description: 'Evergreen files that haven\'t been updated recently may contain outdated facts. Review periodically to keep information current.',
    affectedFiles: stale.map(f => f.relativePath),
    action: 'Review evergreen files for outdated information and update or remove stale content.',
  }
}

function checkNoExplicitConfig(config: MemoryConfig): MemoryHealthCheck | null {
  if (config.configFound) return null

  return {
    id: 'no-config',
    severity: 'info',
    title: 'No explicit memory configuration',
    description: 'Using OpenClaw defaults. Adding explicit memorySearch config in openclaw.json lets you tune search weights, temporal decay, and caching.',
    affectedFiles: null,
    action: 'Add a memorySearch section to openclaw.json to customize search behavior.',
  }
}

function checkTemporalDecayDisabled(config: MemoryConfig): MemoryHealthCheck | null {
  if (!config.memorySearch.enabled) return null
  if (config.memorySearch.hybrid.temporalDecay.enabled) return null

  return {
    id: 'decay-disabled',
    severity: 'info',
    title: 'Temporal decay is disabled',
    description: 'Without temporal decay, old daily logs rank equally with recent ones in search results. Enable decay to prioritize recent context.',
    affectedFiles: null,
    action: 'Enable temporalDecay in openclaw.json to down-rank old daily logs in search.',
  }
}

// ── Main function ────────────────────────────────────────────

export function computeMemoryHealth(
  files: MemoryFileInfo[],
  config: MemoryConfig,
  status: MemoryStatus,
  stats: MemoryStats,
  now = Date.now()
): MemoryHealthSummary {
  const checks: MemoryHealthCheck[] = []

  const checkers = [
    () => checkMemoryMdLineCount(files),
    () => checkFileSizes(files),
    () => checkStaleDailyLogs(files, now),
    () => checkTotalMemorySize(stats),
    () => checkVectorSearchDisabled(config),
    () => checkUnindexedVectorSearch(config, status),
    () => checkStaleIndex(config, status, files, now),
    () => checkStaleEvergreenFiles(files, now),
    () => checkNoExplicitConfig(config),
    () => checkTemporalDecayDisabled(config),
  ]

  for (const checker of checkers) {
    const result = checker()
    if (result) checks.push(result)
  }

  // Sort by severity
  checks.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const score = computeHealthScore(checks)
  const staleDailyLogs = computeStaleDailyLogs(files, now)

  return { score, checks, staleDailyLogs }
}
