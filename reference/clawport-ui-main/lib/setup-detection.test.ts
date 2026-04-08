// @vitest-environment node
/**
 * Tests for setup detection helpers.
 *
 * These simulate the detection logic that runs during `npm run setup`
 * and `clawport doctor`, covering:
 *   - Fresh user: nothing installed
 *   - Partial user: OpenClaw installed but not fully configured
 *   - Existing user: everything configured and running
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { homedir } from 'os'
import { join } from 'path'

// ── Computed paths (using real homedir) ───────────────────────────

const HOME = homedir()
const OPENCLAW_DIR = join(HOME, '.openclaw')
const WORKSPACE_PATH = join(OPENCLAW_DIR, 'workspace')
const CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json')

// ── Hoisted mocks ─────────────────────────────────────────────────

const { mockExistsSync, mockReadFileSync, mockWriteFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}))

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
}))

vi.mock('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync },
}))

// ── Imports (after mocks) ─────────────────────────────────────────

import {
  detectWorkspacePath,
  detectOpenClawBin,
  detectGatewayToken,
  checkHttpEndpointEnabled,
  enableHttpEndpoint,
  detectAll,
} from './setup-detection'

// ═══════════════════════════════════════════════════════════════════
// detectWorkspacePath
// ═══════════════════════════════════════════════════════════════════

describe('detectWorkspacePath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('returns null when ~/.openclaw/workspace does not exist', () => {
    expect(detectWorkspacePath()).toBeNull()
    expect(mockExistsSync).toHaveBeenCalledWith(WORKSPACE_PATH)
  })

  it('returns path when ~/.openclaw/workspace exists', () => {
    mockExistsSync.mockImplementation((p: string) => p === WORKSPACE_PATH)
    expect(detectWorkspacePath()).toBe(WORKSPACE_PATH)
  })
})

// ═══════════════════════════════════════════════════════════════════
// detectOpenClawBin
// ═══════════════════════════════════════════════════════════════════

describe('detectOpenClawBin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when openclaw is not on PATH', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found')
    })
    expect(detectOpenClawBin()).toBeNull()
  })

  it('returns binary path when openclaw is found', () => {
    mockExecSync.mockReturnValue('/usr/local/bin/openclaw\n')
    expect(detectOpenClawBin()).toBe('/usr/local/bin/openclaw')
  })

  it('trims whitespace from result', () => {
    mockExecSync.mockReturnValue('  /opt/openclaw/bin/openclaw  \n')
    expect(detectOpenClawBin()).toBe('/opt/openclaw/bin/openclaw')
  })

  it('uses "which" on non-Windows platforms', () => {
    mockExecSync.mockReturnValue('/usr/local/bin/openclaw')
    detectOpenClawBin()
    // On macOS/Linux, should use "which"
    if (process.platform !== 'win32') {
      expect(mockExecSync).toHaveBeenCalledWith(
        'which openclaw',
        expect.objectContaining({ encoding: 'utf-8' })
      )
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// detectGatewayToken
// ═══════════════════════════════════════════════════════════════════

describe('detectGatewayToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('returns null when openclaw.json does not exist', () => {
    expect(detectGatewayToken()).toBeNull()
  })

  it('returns token from openclaw.json', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        auth: {
          token: 'oc_tok_abc123xyz789',
        },
      },
    }))

    expect(detectGatewayToken()).toBe('oc_tok_abc123xyz789')
  })

  it('returns null when gateway.auth.token is missing', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        http: { port: 18789 },
      },
    }))

    expect(detectGatewayToken()).toBeNull()
  })

  it('returns null when token is not a string', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        auth: { token: 12345 },
      },
    }))

    expect(detectGatewayToken()).toBeNull()
  })

  it('returns null when openclaw.json is malformed', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue('not json')

    expect(detectGatewayToken()).toBeNull()
  })

  it('returns null when readFileSync throws', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES')
    })

    expect(detectGatewayToken()).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════
// checkHttpEndpointEnabled
// ═══════════════════════════════════════════════════════════════════

describe('checkHttpEndpointEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('returns null when openclaw.json does not exist', () => {
    expect(checkHttpEndpointEnabled()).toBeNull()
  })

  it('returns true when chatCompletions endpoint is enabled', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        http: {
          endpoints: {
            chatCompletions: { enabled: true },
          },
        },
      },
    }))

    expect(checkHttpEndpointEnabled()).toBe(true)
  })

  it('returns false when chatCompletions endpoint is disabled', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        http: {
          endpoints: {
            chatCompletions: { enabled: false },
          },
        },
      },
    }))

    expect(checkHttpEndpointEnabled()).toBe(false)
  })

  it('returns false when endpoints key is missing', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: { http: {} },
    }))

    expect(checkHttpEndpointEnabled()).toBe(false)
  })

  it('returns false when chatCompletions key is missing', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        http: { endpoints: {} },
      },
    }))

    expect(checkHttpEndpointEnabled()).toBe(false)
  })

  it('returns null for malformed JSON', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue('{broken}')

    expect(checkHttpEndpointEnabled()).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════
// enableHttpEndpoint
// ═══════════════════════════════════════════════════════════════════

describe('enableHttpEndpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('returns false when openclaw.json does not exist', () => {
    expect(enableHttpEndpoint()).toBe(false)
  })

  it('enables the endpoint and writes back to file', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: { auth: { token: 'test' } },
    }))

    const result = enableHttpEndpoint()

    expect(result).toBe(true)
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)

    // Verify the written content has the endpoint enabled
    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string
    const parsed = JSON.parse(writtenContent.replace(/\n$/, ''))
    expect(parsed.gateway.http.endpoints.chatCompletions.enabled).toBe(true)
    // Preserves existing config
    expect(parsed.gateway.auth.token).toBe('test')
  })

  it('creates nested structure when gateway.http is missing', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({ gateway: {} }))

    const result = enableHttpEndpoint()
    expect(result).toBe(true)

    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string
    const parsed = JSON.parse(writtenContent.replace(/\n$/, ''))
    expect(parsed.gateway.http.endpoints.chatCompletions.enabled).toBe(true)
  })

  it('creates gateway key when missing entirely', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: 1 }))

    const result = enableHttpEndpoint()
    expect(result).toBe(true)

    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string
    const parsed = JSON.parse(writtenContent.replace(/\n$/, ''))
    expect(parsed.version).toBe(1) // preserves existing
    expect(parsed.gateway.http.endpoints.chatCompletions.enabled).toBe(true)
  })

  it('returns false when writeFileSync throws', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockReturnValue(JSON.stringify({}))
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('EACCES')
    })

    expect(enableHttpEndpoint()).toBe(false)
  })

  it('returns false when readFileSync throws', () => {
    mockExistsSync.mockImplementation((p: string) => p === CONFIG_PATH)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES')
    })

    expect(enableHttpEndpoint()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════
// detectAll — integration
// ═══════════════════════════════════════════════════════════════════

describe('detectAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    mockExecSync.mockImplementation(() => {
      throw new Error('not found')
    })
  })

  it('returns all nulls for a completely fresh system', () => {
    const result = detectAll()
    expect(result.workspacePath).toBeNull()
    expect(result.openclawBin).toBeNull()
    expect(result.gatewayToken).toBeNull()
    expect(result.httpEndpointEnabled).toBeNull()
  })

  it('returns all values for a fully configured system', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === WORKSPACE_PATH) return true
      if (p === CONFIG_PATH) return true
      return false
    })
    mockExecSync.mockReturnValue('/usr/local/bin/openclaw')
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        auth: { token: 'oc_tok_test123' },
        http: {
          endpoints: {
            chatCompletions: { enabled: true },
          },
        },
      },
    }))

    const result = detectAll()
    expect(result.workspacePath).toBe(WORKSPACE_PATH)
    expect(result.openclawBin).toBe('/usr/local/bin/openclaw')
    expect(result.gatewayToken).toBe('oc_tok_test123')
    expect(result.httpEndpointEnabled).toBe(true)
  })

  it('handles partial setup (workspace exists, no binary)', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === WORKSPACE_PATH) return true
      if (p === CONFIG_PATH) return true
      return false
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: {
        auth: { token: 'oc_tok_partial' },
      },
    }))

    const result = detectAll()
    expect(result.workspacePath).toBe(WORKSPACE_PATH)
    expect(result.openclawBin).toBeNull()
    expect(result.gatewayToken).toBe('oc_tok_partial')
    expect(result.httpEndpointEnabled).toBe(false) // endpoint key missing
  })

  it('handles workspace without config file', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === WORKSPACE_PATH) return true
      return false
    })
    mockExecSync.mockReturnValue('/usr/local/bin/openclaw')

    const result = detectAll()
    expect(result.workspacePath).toBe(WORKSPACE_PATH)
    expect(result.openclawBin).toBe('/usr/local/bin/openclaw')
    expect(result.gatewayToken).toBeNull()
    expect(result.httpEndpointEnabled).toBeNull()
  })
})
