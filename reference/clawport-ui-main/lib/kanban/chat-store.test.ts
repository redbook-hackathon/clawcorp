// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReadFileSync, mockAppendFileSync, mockMkdirSync, mockExistsSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockExistsSync: vi.fn(),
}))

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  appendFileSync: mockAppendFileSync,
  mkdirSync: mockMkdirSync,
  existsSync: mockExistsSync,
  default: {
    readFileSync: mockReadFileSync,
    appendFileSync: mockAppendFileSync,
    mkdirSync: mockMkdirSync,
    existsSync: mockExistsSync,
  },
}))

import { getChatMessages, appendChatMessages, StoredChatMessage } from './chat-store'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')
  mockExistsSync.mockReturnValue(true)
})

describe('getChatMessages', () => {
  it('parses JSONL lines and returns sorted oldest-first', () => {
    const lines = [
      JSON.stringify({ id: 'c', role: 'assistant', content: 'last', timestamp: 3000 }),
      JSON.stringify({ id: 'a', role: 'user', content: 'first', timestamp: 1000 }),
      JSON.stringify({ id: 'b', role: 'assistant', content: 'second', timestamp: 2000 }),
    ].join('\n')

    mockReadFileSync.mockReturnValue(lines)

    const messages = getChatMessages('ticket-1')
    expect(messages).toHaveLength(3)
    expect(messages[0].id).toBe('a')
    expect(messages[0].timestamp).toBe(1000)
    expect(messages[1].id).toBe('b')
    expect(messages[2].id).toBe('c')
  })

  it('returns empty array when file does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const messages = getChatMessages('missing-ticket')
    expect(messages).toEqual([])
    expect(mockReadFileSync).not.toHaveBeenCalled()
  })

  it('returns empty array when file is empty', () => {
    mockReadFileSync.mockReturnValue('')
    const messages = getChatMessages('empty-ticket')
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

    const messages = getChatMessages('ticket-1')
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

    const messages = getChatMessages('ticket-1')
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('b')
  })

  it('handles unreadable files gracefully', () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('permission denied') })
    const messages = getChatMessages('ticket-1')
    expect(messages).toEqual([])
  })

  it('defaults timestamp to 0 for non-numeric values', () => {
    const lines = JSON.stringify({ id: 'a', role: 'user', content: 'hi', timestamp: 'bad' })
    mockReadFileSync.mockReturnValue(lines)

    const messages = getChatMessages('ticket-1')
    expect(messages).toHaveLength(1)
    expect(messages[0].timestamp).toBe(0)
  })
})

describe('appendChatMessages', () => {
  beforeEach(() => {
    // Reset readFileSync so dedup doesn't pick up stale mock data
    mockReadFileSync.mockReset()
    // Simulate no existing file so dedup is skipped
    mockExistsSync.mockReturnValue(false)
  })

  it('creates directory and appends messages as JSONL', () => {
    const messages: StoredChatMessage[] = [
      { id: 'a', role: 'user', content: 'hello', timestamp: 1000 },
      { id: 'b', role: 'assistant', content: 'hi there', timestamp: 2000 },
    ]

    appendChatMessages('ticket-1', messages)

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('kanban/chats'),
      { recursive: true },
    )

    const written = mockAppendFileSync.mock.calls[0][1] as string
    const lines = written.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({ id: 'a', role: 'user', content: 'hello', timestamp: 1000 })
    expect(JSON.parse(lines[1])).toEqual({ id: 'b', role: 'assistant', content: 'hi there', timestamp: 2000 })
  })

  it('appends single message correctly', () => {
    const messages: StoredChatMessage[] = [
      { id: 'x', role: 'user', content: 'test', timestamp: 5000 },
    ]

    appendChatMessages('ticket-2', messages)

    const written = mockAppendFileSync.mock.calls[0][1] as string
    expect(written).toBe('{"id":"x","role":"user","content":"test","timestamp":5000}\n')
  })

  it('writes to correct file path based on ticketId', () => {
    appendChatMessages('my-ticket-id', [
      { id: 'a', role: 'user', content: 'hi', timestamp: 1000 },
    ])

    const filePath = mockAppendFileSync.mock.calls[0][0] as string
    expect(filePath).toContain('my-ticket-id.jsonl')
  })
})
