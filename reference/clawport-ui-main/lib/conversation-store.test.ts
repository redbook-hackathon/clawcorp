// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockReadFileSync,
  mockAppendFileSync,
  mockMkdirSync,
  mockExistsSync,
  mockUnlinkSync,
  mockReaddirSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  appendFileSync: mockAppendFileSync,
  mkdirSync: mockMkdirSync,
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
  readdirSync: mockReaddirSync,
  writeFileSync: mockWriteFileSync,
  default: {
    readFileSync: mockReadFileSync,
    appendFileSync: mockAppendFileSync,
    mkdirSync: mockMkdirSync,
    existsSync: mockExistsSync,
    unlinkSync: mockUnlinkSync,
    readdirSync: mockReaddirSync,
    writeFileSync: mockWriteFileSync,
  },
}))

import {
  getMessages,
  appendMessages,
  clearConversation,
  validateAgentId,
  listAgentIds,
  isOnboarded,
  setOnboarded,
  StoredMessage,
} from './conversation-store'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')
  mockExistsSync.mockReturnValue(true)
})

// ── getMessages ──────────────────────────────────────────

describe('getMessages', () => {
  it('parses JSONL lines and returns sorted oldest-first', () => {
    const lines = [
      JSON.stringify({ id: 'c', role: 'assistant', content: 'last', timestamp: 3000 }),
      JSON.stringify({ id: 'a', role: 'user', content: 'first', timestamp: 1000 }),
      JSON.stringify({ id: 'b', role: 'assistant', content: 'second', timestamp: 2000 }),
    ].join('\n')

    mockReadFileSync.mockReturnValue(lines)

    const messages = getMessages('agent-1')
    expect(messages).toHaveLength(3)
    expect(messages[0].id).toBe('a')
    expect(messages[0].timestamp).toBe(1000)
    expect(messages[1].id).toBe('b')
    expect(messages[2].id).toBe('c')
  })

  it('returns empty array when file does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const messages = getMessages('missing-agent')
    expect(messages).toEqual([])
    expect(mockReadFileSync).not.toHaveBeenCalled()
  })

  it('returns empty array when file is empty', () => {
    mockReadFileSync.mockReturnValue('')
    const messages = getMessages('empty-agent')
    expect(messages).toEqual([])
  })

  it('skips malformed JSON lines', () => {
    const lines = [
      'not valid json',
      JSON.stringify({ id: 'a', role: 'user', content: 'hi', timestamp: 1000 }),
      '{ broken',
      '',
    ].join('\n')

    mockReadFileSync.mockReturnValue(lines)

    const messages = getMessages('agent-1')
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('a')
  })

  it('skips lines with missing required fields', () => {
    const lines = [
      JSON.stringify({ role: 'user', content: 'no id', timestamp: 1000 }),
      JSON.stringify({ id: '', role: 'user', content: 'empty id', timestamp: 1000 }),
      JSON.stringify({ id: 'a', role: 'system', content: 'bad role', timestamp: 1000 }),
      JSON.stringify({ id: 'b', role: 'user', content: 'valid', timestamp: 2000 }),
    ].join('\n')

    mockReadFileSync.mockReturnValue(lines)

    const messages = getMessages('agent-1')
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('b')
  })

  it('handles unreadable files gracefully', () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('permission denied') })
    const messages = getMessages('agent-1')
    expect(messages).toEqual([])
  })

  it('defaults timestamp to 0 for non-numeric values', () => {
    const lines = JSON.stringify({ id: 'a', role: 'user', content: 'hi', timestamp: 'bad' })
    mockReadFileSync.mockReturnValue(lines)

    const messages = getMessages('agent-1')
    expect(messages).toHaveLength(1)
    expect(messages[0].timestamp).toBe(0)
  })
})

// ── appendMessages ───────────────────────────────────────

describe('appendMessages', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset()
    mockExistsSync.mockReturnValue(false)
  })

  it('creates directory and appends messages as JSONL', () => {
    const messages: StoredMessage[] = [
      { id: 'a', role: 'user', content: 'hello', timestamp: 1000 },
      { id: 'b', role: 'assistant', content: 'hi there', timestamp: 2000 },
    ]

    appendMessages('agent-1', messages)

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('conversations'),
      { recursive: true },
    )

    const written = mockAppendFileSync.mock.calls[0][1] as string
    const lines = written.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({ id: 'a', role: 'user', content: 'hello', timestamp: 1000 })
    expect(JSON.parse(lines[1])).toEqual({ id: 'b', role: 'assistant', content: 'hi there', timestamp: 2000 })
  })

  it('appends single message correctly', () => {
    const messages: StoredMessage[] = [
      { id: 'x', role: 'user', content: 'test', timestamp: 5000 },
    ]

    appendMessages('agent-2', messages)

    const written = mockAppendFileSync.mock.calls[0][1] as string
    expect(written).toBe('{"id":"x","role":"user","content":"test","timestamp":5000}\n')
  })

  it('writes to correct file path based on agentId', () => {
    appendMessages('my-agent-id', [
      { id: 'a', role: 'user', content: 'hi', timestamp: 1000 },
    ])

    const filePath = mockAppendFileSync.mock.calls[0][0] as string
    expect(filePath).toContain('my-agent-id.jsonl')
  })

  it('deduplicates against existing messages', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ id: 'a', role: 'user', content: 'exists', timestamp: 1000 })
    )

    appendMessages('agent-1', [
      { id: 'a', role: 'user', content: 'exists', timestamp: 1000 },
      { id: 'b', role: 'assistant', content: 'new', timestamp: 2000 },
    ])

    const written = mockAppendFileSync.mock.calls[0][1] as string
    const lines = written.trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]).id).toBe('b')
  })
})

// ── clearConversation ────────────────────────────────────

describe('clearConversation', () => {
  it('unlinks the conversation file', () => {
    clearConversation('agent-1')
    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('agent-1.jsonl')
    )
  })

  it('does not throw if file does not exist', () => {
    mockUnlinkSync.mockImplementation(() => { throw new Error('ENOENT') })
    expect(() => clearConversation('agent-1')).not.toThrow()
  })

  it('throws on invalid agent ID', () => {
    expect(() => clearConversation('../etc/passwd')).toThrow('Invalid agent ID')
  })
})

// ── validateAgentId ──────────────────────────────────────

describe('validateAgentId', () => {
  it('accepts valid agent IDs', () => {
    expect(() => validateAgentId('agent-1')).not.toThrow()
    expect(() => validateAgentId('my_agent_v2')).not.toThrow()
    expect(() => validateAgentId('ABC123')).not.toThrow()
  })

  it('rejects path traversal', () => {
    expect(() => validateAgentId('../etc/passwd')).toThrow('Invalid agent ID')
  })

  it('rejects empty string', () => {
    expect(() => validateAgentId('')).toThrow('Invalid agent ID')
  })

  it('rejects special characters', () => {
    expect(() => validateAgentId('agent.id')).toThrow('Invalid agent ID')
    expect(() => validateAgentId('agent/id')).toThrow('Invalid agent ID')
    expect(() => validateAgentId('agent id')).toThrow('Invalid agent ID')
  })
})

// ── listAgentIds ─────────────────────────────────────────

describe('listAgentIds', () => {
  it('returns agent IDs from .jsonl filenames', () => {
    mockReaddirSync.mockReturnValue(['alpha.jsonl', 'beta.jsonl', 'readme.txt'])
    const ids = listAgentIds()
    expect(ids).toEqual(['alpha', 'beta'])
  })

  it('returns empty array when directory does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    expect(listAgentIds()).toEqual([])
  })

  it('handles read errors gracefully', () => {
    mockReaddirSync.mockImplementation(() => { throw new Error('permission denied') })
    expect(listAgentIds()).toEqual([])
  })
})

// ── isOnboarded / setOnboarded ───────────────────────────

describe('isOnboarded', () => {
  it('returns true when marker file exists', () => {
    mockExistsSync.mockReturnValue(true)
    expect(isOnboarded()).toBe(true)
  })

  it('returns false when marker file does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    expect(isOnboarded()).toBe(false)
  })
})

describe('setOnboarded', () => {
  it('creates marker file when set to true', () => {
    setOnboarded(true)
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('clawport'),
      { recursive: true },
    )
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.onboarded'),
      '1',
      'utf-8',
    )
  })

  it('removes marker file when set to false', () => {
    setOnboarded(false)
    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('.onboarded')
    )
  })
})

// ── MAX_MESSAGES cap ─────────────────────────────────────

describe('MAX_MESSAGES cap', () => {
  it('caps returned messages at 500 (keeping newest)', () => {
    const lines = Array.from({ length: 600 }, (_, i) =>
      JSON.stringify({ id: `msg-${i}`, role: 'user', content: `msg ${i}`, timestamp: i })
    ).join('\n')

    mockReadFileSync.mockReturnValue(lines)

    const messages = getMessages('agent-1')
    expect(messages).toHaveLength(500)
    expect(messages[0].id).toBe('msg-100')
    expect(messages[499].id).toBe('msg-599')
  })
})
