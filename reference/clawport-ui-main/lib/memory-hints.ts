import type { MemoryFileInfo, MemoryConfig, EditingHint } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────

const EVERGREEN_HEADINGS = /^#\s+(architecture|stack|conventions?|patterns?|principles?|tech|setup|config)/im

function isMemoryMd(file: MemoryFileInfo): boolean {
  return file.relativePath === 'MEMORY.md'
}

function isDailyLog(file: MemoryFileInfo): boolean {
  return file.category === 'daily'
}

function isJsonFile(file: MemoryFileInfo): boolean {
  return file.relativePath.endsWith('.json')
}

function isMdFile(file: MemoryFileInfo): boolean {
  return file.relativePath.endsWith('.md')
}

// ── Hint checks ──────────────────────────────────────────────

function checkLineCount(file: MemoryFileInfo, content: string): EditingHint | null {
  if (!isMemoryMd(file)) return null

  const lines = content.split('\n').length

  if (lines > 200) {
    return {
      id: 'line-count',
      text: `MEMORY.md has ${lines} lines (limit: 200). Lines past 200 are truncated in agent context. Split into topic files.`,
      severity: 'warning',
    }
  }

  if (lines > 150) {
    return {
      id: 'line-count',
      text: `MEMORY.md has ${lines} lines. Consider splitting before reaching the 200-line limit.`,
      severity: 'tip',
    }
  }

  return null
}

function checkEvergreenInDaily(file: MemoryFileInfo, content: string): EditingHint | null {
  if (!isDailyLog(file)) return null
  if (!EVERGREEN_HEADINGS.test(content)) return null

  return {
    id: 'evergreen-in-daily',
    text: 'This daily log contains headings that look like evergreen content. Consider moving stable patterns to a dedicated file.',
    severity: 'tip',
  }
}

function checkMissingHeaders(file: MemoryFileInfo, content: string): EditingHint | null {
  if (!isMdFile(file)) return null

  const lines = content.split('\n')
  if (lines.length <= 20) return null

  const hasHeaders = lines.some(l => /^#{1,6}\s/.test(l))
  if (hasHeaders) return null

  return {
    id: 'missing-headers',
    text: 'This file has over 20 lines with no markdown headers. Adding headers improves search chunk quality.',
    severity: 'tip',
  }
}

function checkInvalidJson(file: MemoryFileInfo, content: string): EditingHint | null {
  if (!isJsonFile(file)) return null

  try {
    JSON.parse(content)
    return null
  } catch {
    return {
      id: 'invalid-json',
      text: 'Invalid JSON syntax. Fix before saving to prevent parse errors.',
      severity: 'warning',
    }
  }
}

function checkLongLines(file: MemoryFileInfo, content: string): EditingHint | null {
  const lines = content.split('\n')
  const longLines = lines.filter(l => l.length > 500).length

  if (longLines === 0) return null

  return {
    id: 'long-lines',
    text: `${longLines} line${longLines > 1 ? 's' : ''} over 500 characters. Long lines can hurt chunk-based retrieval.`,
    severity: 'tip',
  }
}

function checkReindexReminder(config: MemoryConfig | null): EditingHint | null {
  if (!config) return null
  if (!config.memorySearch.enabled) return null

  return {
    id: 'reindex-reminder',
    text: 'Vector search is enabled. After saving, reindex so agents pick up your changes.',
    severity: 'tip',
  }
}

// ── Main function ────────────────────────────────────────────

export function computeEditingHints(
  file: MemoryFileInfo,
  content: string,
  config: MemoryConfig | null
): EditingHint[] {
  const hints: EditingHint[] = []

  const checkers = [
    () => checkLineCount(file, content),
    () => checkEvergreenInDaily(file, content),
    () => checkMissingHeaders(file, content),
    () => checkInvalidJson(file, content),
    () => checkLongLines(file, content),
    () => checkReindexReminder(config),
  ]

  for (const checker of checkers) {
    const result = checker()
    if (result) hints.push(result)
  }

  return hints
}
