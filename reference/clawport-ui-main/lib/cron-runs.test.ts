// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReadFileSync, mockReaddirSync, mockExistsSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockExistsSync: vi.fn(),
}))

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
  existsSync: mockExistsSync,
  default: { readFileSync: mockReadFileSync, readdirSync: mockReaddirSync, existsSync: mockExistsSync },
}))

import { getCronRuns } from './cron-runs'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')
  mockExistsSync.mockReturnValue(true)
})

describe('getCronRuns', () => {
  it('parses JSONL lines and returns sorted newest-first', () => {
    const lines = [
      JSON.stringify({ ts: 1000, jobId: 'a', action: 'finished', status: 'ok', summary: 'done', durationMs: 5000, deliveryStatus: 'delivered' }),
      JSON.stringify({ ts: 3000, jobId: 'a', action: 'finished', status: 'error', error: 'timeout', durationMs: 10000, deliveryStatus: 'unknown' }),
      JSON.stringify({ ts: 2000, jobId: 'a', action: 'finished', status: 'ok', summary: 'ok', durationMs: 3000, deliveryStatus: 'delivered' }),
    ].join('\n')

    mockReaddirSync.mockReturnValue(['a.jsonl'])
    mockReadFileSync.mockReturnValue(lines)

    const runs = getCronRuns()
    expect(runs).toHaveLength(3)
    expect(runs[0].ts).toBe(3000)
    expect(runs[0].status).toBe('error')
    expect(runs[1].ts).toBe(2000)
    expect(runs[2].ts).toBe(1000)
  })

  it('filters by jobId when provided', () => {
    const lines = JSON.stringify({ ts: 1000, jobId: 'abc', action: 'finished', status: 'ok', durationMs: 100 })
    mockReadFileSync.mockReturnValue(lines)

    const runs = getCronRuns('abc')
    expect(runs).toHaveLength(1)
    expect(runs[0].jobId).toBe('abc')
    // Should not call readdirSync when filtering by jobId
    expect(mockReaddirSync).not.toHaveBeenCalled()
  })

  it('returns empty array when runs dir does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const runs = getCronRuns()
    expect(runs).toEqual([])
  })

  it('skips non-finished actions', () => {
    const lines = [
      JSON.stringify({ ts: 1000, jobId: 'a', action: 'started', status: 'ok' }),
      JSON.stringify({ ts: 2000, jobId: 'a', action: 'finished', status: 'ok', durationMs: 100 }),
    ].join('\n')

    mockReaddirSync.mockReturnValue(['a.jsonl'])
    mockReadFileSync.mockReturnValue(lines)

    const runs = getCronRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].ts).toBe(2000)
  })

  it('skips malformed JSON lines', () => {
    const lines = [
      'not valid json',
      JSON.stringify({ ts: 1000, jobId: 'a', action: 'finished', status: 'ok', durationMs: 100 }),
      '{ broken',
    ].join('\n')

    mockReaddirSync.mockReturnValue(['a.jsonl'])
    mockReadFileSync.mockReturnValue(lines)

    const runs = getCronRuns()
    expect(runs).toHaveLength(1)
  })

  it('skips empty lines', () => {
    const lines = '\n\n' + JSON.stringify({ ts: 1000, jobId: 'a', action: 'finished', status: 'ok', durationMs: 100 }) + '\n\n'
    mockReaddirSync.mockReturnValue(['a.jsonl'])
    mockReadFileSync.mockReturnValue(lines)

    const runs = getCronRuns()
    expect(runs).toHaveLength(1)
  })

  it('handles unreadable files gracefully', () => {
    mockReaddirSync.mockReturnValue(['a.jsonl', 'b.jsonl'])
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.includes('a.jsonl')) throw new Error('permission denied')
      return JSON.stringify({ ts: 1000, jobId: 'b', action: 'finished', status: 'ok', durationMs: 100 })
    })

    const runs = getCronRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].jobId).toBe('b')
  })

  it('returns empty when jobId file does not exist', () => {
    mockExistsSync.mockImplementation((p: string) => {
      // Runs dir exists but specific file does not
      return !p.endsWith('.jsonl')
    })
    const runs = getCronRuns('nonexistent')
    expect(runs).toEqual([])
  })

  it('parses model, provider, and usage fields', () => {
    const line = JSON.stringify({
      ts: 5000, jobId: 'x', action: 'finished', status: 'ok', durationMs: 100,
      model: 'claude-sonnet-4-6', provider: 'anthropic',
      usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 },
    })
    mockReaddirSync.mockReturnValue(['x.jsonl'])
    mockReadFileSync.mockReturnValue(line)

    const runs = getCronRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].model).toBe('claude-sonnet-4-6')
    expect(runs[0].provider).toBe('anthropic')
    expect(runs[0].usage).toEqual({ input_tokens: 1000, output_tokens: 200, total_tokens: 1200 })
  })

  it('returns null for model/provider/usage when missing', () => {
    const line = JSON.stringify({
      ts: 6000, jobId: 'y', action: 'finished', status: 'ok', durationMs: 50,
    })
    mockReaddirSync.mockReturnValue(['y.jsonl'])
    mockReadFileSync.mockReturnValue(line)

    const runs = getCronRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].model).toBeNull()
    expect(runs[0].provider).toBeNull()
    expect(runs[0].usage).toBeNull()
  })
})
