// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecSync, mockReadFileSync, mockWriteFileSync, mockMkdirSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync },
}))

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}))

import { getKeychainToken, fetchClaudeCodeUsage } from './claude-usage'

const KEYCHAIN_JSON = (token: string) => JSON.stringify({
  claudeAiOauth: {
    accessToken: token,
    refreshToken: 'rt-123',
    expiresAt: Date.now() + 86400000,
    scopes: ['user:inference'],
  },
})

describe('getKeychainToken', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('extracts accessToken from keychain JSON', () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('sk-ant-oat01-abc'))
    expect(getKeychainToken()).toBe('sk-ant-oat01-abc')
  })

  it('returns null when keychain lookup fails', () => {
    mockExecSync.mockImplementation(() => { throw new Error('security: SecKeychainSearchCopyNext') })
    expect(getKeychainToken()).toBeNull()
  })

  it('returns null for empty keychain value', () => {
    mockExecSync.mockReturnValue('')
    expect(getKeychainToken()).toBeNull()
  })

  it('returns null when JSON has no accessToken', () => {
    mockExecSync.mockReturnValue(JSON.stringify({ claudeAiOauth: {} }))
    expect(getKeychainToken()).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    mockExecSync.mockReturnValue('not-json')
    expect(getKeychainToken()).toBeNull()
  })
})

describe('fetchClaudeCodeUsage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
  })

  it('returns null when keychain has no token', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    const result = await fetchClaudeCodeUsage()
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('parses API response correctly', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        five_hour: { utilization: 42.5, resets_at: '2026-03-09T15:00:00Z' },
        seven_day: { utilization: 18.2, resets_at: '2026-03-14T00:00:00Z' },
      }),
    })

    const result = await fetchClaudeCodeUsage()
    expect(result).toEqual({
      fiveHour: { utilization: 42.5, resetsAt: '2026-03-09T15:00:00Z' },
      sevenDay: { utilization: 18.2, resetsAt: '2026-03-14T00:00:00Z' },
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/api/oauth/usage',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'anthropic-beta': 'oauth-2025-04-20',
        }),
      }),
    )
  })

  it('retries on 429 then succeeds', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          five_hour: { utilization: 30, resets_at: '2026-03-10T01:00:00Z' },
          seven_day: { utilization: 12, resets_at: '2026-03-15T00:00:00Z' },
        }),
      })

    const result = await fetchClaudeCodeUsage()
    expect(result).toEqual({
      fiveHour: { utilization: 30, resetsAt: '2026-03-10T01:00:00Z' },
      sevenDay: { utilization: 12, resetsAt: '2026-03-15T00:00:00Z' },
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('returns cached data on non-200 when cache has real values', async () => {
    const cached = { fiveHour: { utilization: 10, resetsAt: null }, sevenDay: { utilization: 5, resetsAt: null } }
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    mockReadFileSync.mockReturnValue(JSON.stringify(cached))

    const result = await fetchClaudeCodeUsage()
    expect(result).toEqual(cached)
  })

  it('does NOT return cached zeros', async () => {
    const zeros = { fiveHour: { utilization: 0, resetsAt: null }, sevenDay: { utilization: 0, resetsAt: null } }
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    mockReadFileSync.mockReturnValue(JSON.stringify(zeros))

    const result = await fetchClaudeCodeUsage()
    expect(result).toBeNull()
  })

  it('returns null on fetch error when no cache', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))

    const result = await fetchClaudeCodeUsage()
    expect(result).toBeNull()
  })

  it('handles missing fields gracefully', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const result = await fetchClaudeCodeUsage()
    expect(result).toEqual({
      fiveHour: { utilization: 0, resetsAt: null },
      sevenDay: { utilization: 0, resetsAt: null },
    })
  })

  it('does NOT write cache when API returns zeros', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    await fetchClaudeCodeUsage()
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('writes cache on successful fetch with real values', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        five_hour: { utilization: 50, resets_at: '2026-03-10T00:00:00Z' },
        seven_day: { utilization: 20, resets_at: '2026-03-15T00:00:00Z' },
      }),
    })

    await fetchClaudeCodeUsage()
    expect(mockWriteFileSync).toHaveBeenCalled()
  })
})
