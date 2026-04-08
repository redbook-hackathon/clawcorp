import { describe, it, expect } from 'vitest'
import type { MemoryFileInfo, MemoryConfig } from './types'
import { computeEditingHints } from './memory-hints'

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

// ── Line count hints ─────────────────────────────────────────

describe('line count hints', () => {
  it('warns when MEMORY.md exceeds 200 lines', () => {
    const file = makeFile({ relativePath: 'MEMORY.md' })
    const content = Array(210).fill('line').join('\n')
    const hints = computeEditingHints(file, content, null)
    const hint = hints.find(h => h.id === 'line-count')
    expect(hint).toBeDefined()
    expect(hint!.severity).toBe('warning')
  })

  it('tips when MEMORY.md exceeds 150 lines', () => {
    const file = makeFile({ relativePath: 'MEMORY.md' })
    const content = Array(160).fill('line').join('\n')
    const hints = computeEditingHints(file, content, null)
    const hint = hints.find(h => h.id === 'line-count')
    expect(hint).toBeDefined()
    expect(hint!.severity).toBe('tip')
  })

  it('does not flag MEMORY.md under 150 lines', () => {
    const file = makeFile({ relativePath: 'MEMORY.md' })
    const content = Array(100).fill('line').join('\n')
    const hints = computeEditingHints(file, content, null)
    const hint = hints.find(h => h.id === 'line-count')
    expect(hint).toBeUndefined()
  })

  it('does not flag non-MEMORY.md files', () => {
    const file = makeFile({ relativePath: 'memory/patterns.md' })
    const content = Array(250).fill('line').join('\n')
    const hints = computeEditingHints(file, content, null)
    const hint = hints.find(h => h.id === 'line-count')
    expect(hint).toBeUndefined()
  })
})

// ── Evergreen in daily ───────────────────────────────────────

describe('evergreen in daily log', () => {
  it('detects architecture heading in daily log', () => {
    const file = makeFile({ category: 'daily', relativePath: 'memory/2026-03-01.md' })
    const content = '# Architecture\nThis is the architecture...'
    const hints = computeEditingHints(file, content, null)
    const hint = hints.find(h => h.id === 'evergreen-in-daily')
    expect(hint).toBeDefined()
  })

  it('detects stack heading in daily log', () => {
    const file = makeFile({ category: 'daily', relativePath: 'memory/2026-03-01.md' })
    const content = '# Stack\nNode.js, React, etc.'
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'evergreen-in-daily')).toBeDefined()
  })

  it('does not flag evergreen files', () => {
    const file = makeFile({ category: 'evergreen' })
    const content = '# Architecture\nStable patterns'
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'evergreen-in-daily')).toBeUndefined()
  })
})

// ── Missing headers ──────────────────────────────────────────

describe('missing markdown headers', () => {
  it('flags md file with 25+ lines and no headers', () => {
    const file = makeFile()
    const content = Array(25).fill('Some text without headers').join('\n')
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'missing-headers')).toBeDefined()
  })

  it('does not flag md file under 20 lines', () => {
    const file = makeFile()
    const content = Array(15).fill('Some text').join('\n')
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'missing-headers')).toBeUndefined()
  })

  it('does not flag md file with headers', () => {
    const file = makeFile()
    const content = '# Title\n' + Array(25).fill('Some text').join('\n')
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'missing-headers')).toBeUndefined()
  })

  it('does not flag json files', () => {
    const file = makeFile({ relativePath: 'memory/data.json', path: '/ws/memory/data.json' })
    const content = Array(25).fill('"key": "value"').join('\n')
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'missing-headers')).toBeUndefined()
  })
})

// ── Invalid JSON ─────────────────────────────────────────────

describe('invalid JSON', () => {
  it('warns on invalid JSON in .json file', () => {
    const file = makeFile({ relativePath: 'memory/data.json', path: '/ws/memory/data.json' })
    const content = '{ invalid json'
    const hints = computeEditingHints(file, content, null)
    const hint = hints.find(h => h.id === 'invalid-json')
    expect(hint).toBeDefined()
    expect(hint!.severity).toBe('warning')
  })

  it('does not flag valid JSON', () => {
    const file = makeFile({ relativePath: 'memory/data.json', path: '/ws/memory/data.json' })
    const content = '{"key": "value"}'
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'invalid-json')).toBeUndefined()
  })

  it('does not check .md files for JSON', () => {
    const file = makeFile()
    const content = '{ not json }'
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'invalid-json')).toBeUndefined()
  })
})

// ── Long lines ───────────────────────────────────────────────

describe('long lines', () => {
  it('flags lines over 500 characters', () => {
    const file = makeFile()
    const content = 'A'.repeat(600) + '\nShort line'
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'long-lines')).toBeDefined()
  })

  it('does not flag short lines', () => {
    const file = makeFile()
    const content = 'Short content\nAnother line'
    const hints = computeEditingHints(file, content, null)
    expect(hints.find(h => h.id === 'long-lines')).toBeUndefined()
  })
})

// ── Reindex reminder ─────────────────────────────────────────

describe('reindex reminder', () => {
  it('shows when vector search is enabled', () => {
    const file = makeFile()
    const config = makeConfig({
      memorySearch: { ...makeConfig().memorySearch, enabled: true },
    })
    const hints = computeEditingHints(file, 'content', config)
    expect(hints.find(h => h.id === 'reindex-reminder')).toBeDefined()
  })

  it('does not show when vector search is disabled', () => {
    const file = makeFile()
    const config = makeConfig()
    const hints = computeEditingHints(file, 'content', config)
    expect(hints.find(h => h.id === 'reindex-reminder')).toBeUndefined()
  })

  it('does not show when config is null', () => {
    const file = makeFile()
    const hints = computeEditingHints(file, 'content', null)
    expect(hints.find(h => h.id === 'reindex-reminder')).toBeUndefined()
  })
})
