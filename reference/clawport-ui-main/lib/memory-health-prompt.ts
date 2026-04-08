import type {
  MemoryFileInfo,
  MemoryConfig,
  MemoryStatus,
  MemoryStats,
  MemoryHealthSummary,
  MemoryHealthCheck,
  StaleDailyLogInfo,
} from '@/lib/types'

// ── Full system prompt ──────────────────────────────────────

export function buildMemoryHealthPrompt(
  files: MemoryFileInfo[],
  config: MemoryConfig,
  status: MemoryStatus,
  stats: MemoryStats,
  health: MemoryHealthSummary,
): string {
  const memoryMd = files.find(f => f.relativePath === 'MEMORY.md')
  const memoryMdLines = memoryMd ? memoryMd.content.split('\n').length : 0

  const fileList = files.map(f =>
    `  ${f.relativePath} (${formatBytes(f.sizeBytes)}, ${f.category}, modified ${f.lastModified})`
  ).join('\n')

  const checksSection = health.checks.length > 0
    ? health.checks.map(c =>
        `  [${c.severity.toUpperCase()}] ${c.title}: ${c.description}${c.affectedFiles ? ` (files: ${c.affectedFiles.join(', ')})` : ''}`
      ).join('\n')
    : '  No issues detected'

  const staleLogs = health.staleDailyLogs.length > 0
    ? health.staleDailyLogs.map(l =>
        `  ${l.relativePath} -- ${l.date}, ${l.ageDays} days old, ${formatBytes(l.sizeBytes)}`
      ).join('\n')
    : '  None'

  const configSection = [
    `  Vector search: ${config.memorySearch.enabled ? 'enabled' : 'disabled'}`,
    `  Temporal decay: ${config.memorySearch.hybrid.temporalDecay.enabled ? `enabled (half-life: ${config.memorySearch.hybrid.temporalDecay.halfLifeDays}d)` : 'disabled'}`,
    `  Cache: ${config.memorySearch.cache.enabled ? `enabled (${config.memorySearch.cache.maxEntries} entries)` : 'disabled'}`,
    `  Config file found: ${config.configFound ? 'yes' : 'no (using defaults)'}`,
  ].join('\n')

  const indexSection = [
    `  Indexed: ${status.indexed ? 'yes' : 'no'}`,
    `  Last indexed: ${status.lastIndexed || 'never'}`,
    `  Total entries: ${status.totalEntries ?? 'unknown'}`,
  ].join('\n')

  return `You are a memory system advisor for OpenClaw AI agents. You help operators optimize their agent memory for fast, relevant retrieval and clean context injection.

## Best Practices

- MEMORY.md is always loaded into agent context. Lines after 200 are truncated. Keep it concise with links to topic files.
- Individual files should stay under 50KB for optimal chunk-based retrieval. Over 100KB degrades search quality.
- Daily logs older than 30 days should be reviewed: promote useful patterns to evergreen files, then delete the log.
- Temporal decay (when enabled) down-ranks old daily logs in search results, prioritizing recent context.
- After editing memory files, reindex so agents see the latest content in semantic search.
- A well-organized memory has a few focused evergreen files and a rolling window of recent daily logs.

## Current State

- Total files: ${stats.totalFiles}
- Total size: ${formatBytes(stats.totalSizeBytes)}
- Evergreen: ${stats.evergreenCount} files
- Daily logs: ${stats.dailyLogCount} files${stats.oldestDaily ? ` (${stats.oldestDaily} to ${stats.newestDaily})` : ''}
- Health score: ${health.score}/100
- MEMORY.md: ${memoryMdLines} lines${memoryMdLines > 200 ? ' (TRUNCATED -- over 200 line limit)' : ''}

## Files

${fileList || '  No files'}

## Active Health Checks

${checksSection}

## Stale Daily Logs (30+ days)

${staleLogs}

## Configuration

${configSection}

## Index Status

${indexSection}

## Response Format

Provide:
1. **Status summary** -- one sentence on overall memory health
2. **Priority action plan** -- numbered list, most impactful first
3. **File-specific guidance** -- for each problem file, what to do and why

Rules:
- Be direct and specific. Name exact files and actions.
- Explain *why* each action matters (retrieval quality, context injection, search relevance).
- Do not suggest actions for healthy areas.
- Keep under 400 words.`
}

// ── Per-check targeted prompt ───────────────────────────────

export function buildCheckFixPrompt(
  check: MemoryHealthCheck,
  files: MemoryFileInfo[],
): string {
  const baseContext = buildFileContext(check, files)

  switch (check.id) {
    case 'memory-md-lines': {
      const memoryMd = files.find(f => f.relativePath === 'MEMORY.md')
      const content = memoryMd?.content ?? ''
      const lineCount = content.split('\n').length
      return `The user's MEMORY.md has ${lineCount} lines. Lines after 200 are truncated when loaded into agent context, so content beyond line 200 is invisible to agents.

Here is the current MEMORY.md content:

\`\`\`markdown
${content}
\`\`\`

${baseContext}

Please:
1. Identify which sections can be extracted into separate topic files (e.g., patterns.md, debugging.md, architecture.md)
2. Suggest specific filenames for each extracted section
3. Show what the slimmed-down MEMORY.md should look like (with links to the new files)
4. Explain the 200-line truncation rule and why this matters for agent behavior`
    }

    case 'file-size': {
      const affected = check.affectedFiles ?? []
      const details = affected.map(path => {
        const f = files.find(fi => fi.relativePath === path)
        return f ? `  ${f.relativePath}: ${formatBytes(f.sizeBytes)}` : `  ${path}`
      }).join('\n')

      return `The following memory files are too large for optimal retrieval:

${details}

${baseContext}

Large files dilute vector search results because chunks from one large file can crowd out matches from other files. Chunk-based retrieval works best with focused, well-structured files under 50KB.

Please:
1. For each oversized file, identify natural splitting points (by topic, by section heading)
2. Suggest new filenames for each split
3. Explain how this improves search precision for agents`
    }

    case 'stale-daily-logs': {
      const stalePaths = check.affectedFiles ?? []
      const details = stalePaths.map(path => {
        const f = files.find(fi => fi.relativePath === path)
        return f ? `  ${f.relativePath}: ${formatBytes(f.sizeBytes)}` : `  ${path}`
      }).join('\n')

      return `The following daily logs are stale (30+ days old):

${details}

${baseContext}

Daily logs are meant to capture session-specific context. Old logs add noise to search results and slow retrieval. However, some may contain valuable patterns worth preserving.

Please walk through each stale log and suggest:
1. Which content (if any) should be promoted to an evergreen file (and which file)
2. Which logs can be safely deleted
3. Explain temporal decay and how it affects old daily logs in search results`
    }

    case 'total-size': {
      const bySize = [...files].sort((a, b) => b.sizeBytes - a.sizeBytes)
      const breakdown = bySize.slice(0, 10).map(f =>
        `  ${f.relativePath}: ${formatBytes(f.sizeBytes)} (${f.category})`
      ).join('\n')

      return `Total memory size is ${formatBytes(files.reduce((s, f) => s + f.sizeBytes, 0))}. Large memory stores degrade search quality and increase embedding costs.

Size breakdown (largest first):

${breakdown}

${baseContext}

Please:
1. Prioritize what to prune (largest files, stale daily logs, redundant content)
2. Show the expected size after cleanup
3. Explain how total size affects retrieval quality and embedding costs`
    }

    case 'vector-search-disabled': {
      return `Vector search is currently disabled. Agents can only access MEMORY.md directly -- they cannot semantically search your other memory files (evergreen docs, daily logs, topic files).

${baseContext}

OpenClaw's vector search lets agents find relevant memory chunks across all files using semantic similarity, not just keyword matching. Without it, agents miss context that isn't in MEMORY.md.

Please:
1. Explain what vector search does and why it matters for agent memory retrieval
2. Show the config to enable it in openclaw.json (memorySearch.enabled: true, with recommended hybrid search weights)
3. Tell the user to run "openclaw memory reindex" after enabling to build the initial index
4. Mention that reindexing is needed after future memory edits too`
    }

    case 'unindexed-vector': {
      return `Vector search is enabled in the configuration but no search index has been built. This means agents cannot use semantic search to find relevant memory content -- they can only access MEMORY.md directly.

${baseContext}

Please:
1. Explain what reindexing does (builds vector embeddings for each memory file chunk)
2. Explain why agents can't search without an index
3. Tell the user to click the "Reindex now" button or run "openclaw memory reindex" from the CLI`
    }

    case 'stale-index': {
      const affected = check.affectedFiles ?? []
      const details = affected.map(path => {
        const f = files.find(fi => fi.relativePath === path)
        return f ? `  ${f.relativePath}: modified ${f.lastModified}` : `  ${path}`
      }).join('\n')

      return `The search index is stale. These files were modified after the last index build:

${details}

${baseContext}

When the index is stale, agents may miss recent edits because their semantic search returns outdated chunks. The gap between edit and reindex is a feedback delay for agents.

Please:
1. List which files changed and what kind of impact this has
2. Explain the edit-to-agent feedback gap
3. Recommend reindexing now`
    }

    case 'stale-evergreen': {
      const affected = check.affectedFiles ?? []
      const details = affected.map(path => {
        const f = files.find(fi => fi.relativePath === path)
        return f ? `  ${f.relativePath}: last modified ${f.lastModified}` : `  ${path}`
      }).join('\n')

      return `These evergreen files haven't been updated in 90+ days:

${details}

${baseContext}

Evergreen files are meant to contain stable, long-lived knowledge. But "stable" doesn't mean "forgotten" -- projects evolve and facts change.

Please:
1. For each stale file, suggest a review checklist (are facts still accurate? has the project changed? are there new patterns to add?)
2. Note which files might be safe to leave as-is vs which likely need updates`
    }

    case 'no-config': {
      return `No explicit memory configuration was found. The system is using OpenClaw defaults.

${baseContext}

Adding a memorySearch section to openclaw.json gives you control over search weights, temporal decay, and caching.

Please:
1. Show an example memorySearch config block with recommended defaults:
   - Vector search enabled
   - Hybrid search with 0.7 vector / 0.3 text weights
   - Temporal decay enabled with 14-day half-life
   - Cache enabled with 100 entries
2. Explain what each setting does and when you'd change it`
    }

    case 'decay-disabled': {
      return `Temporal decay is currently disabled. Without it, a 90-day-old daily log ranks equally with yesterday's log in search results.

${baseContext}

Please:
1. Explain the trade-offs: decay improves recency bias but may hide still-relevant old content
2. Show the config to enable temporal decay (halfLifeDays: 14 is a good default)
3. Explain when you'd want decay disabled (e.g., all-evergreen memory with no daily logs)`
    }

    default:
      return `A health check flagged an issue: ${check.title}

${check.description}

${baseContext}

Please explain what this means and suggest specific actions to resolve it.`
  }
}

// ── Helpers ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)}KB`
  return `${(kb / 1024).toFixed(1)}MB`
}

function buildFileContext(check: MemoryHealthCheck, files: MemoryFileInfo[]): string {
  if (!check.affectedFiles || check.affectedFiles.length === 0) return ''
  const affected = check.affectedFiles
    .map(path => {
      const f = files.find(fi => fi.relativePath === path)
      return f ? `- ${f.relativePath} (${formatBytes(f.sizeBytes)}, ${f.category})` : `- ${path}`
    })
    .join('\n')
  return `Affected files:\n${affected}`
}
