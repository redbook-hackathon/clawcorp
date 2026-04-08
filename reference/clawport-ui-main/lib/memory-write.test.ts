// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExistsSync, mockStatSync, mockWriteFileSync, mockRenameSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockRenameSync: vi.fn(),
}))

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  statSync: mockStatSync,
  writeFileSync: mockWriteFileSync,
  renameSync: mockRenameSync,
  default: {
    existsSync: mockExistsSync,
    statSync: mockStatSync,
    writeFileSync: mockWriteFileSync,
    renameSync: mockRenameSync,
  },
}))

vi.mock('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync },
}))

import {
  validateMemoryPath,
  resolveMemoryPath,
  snapshotFile,
  normalizeContent,
  writeMemoryFile,
  PathValidationError,
} from './memory-write'

const WS = '/tmp/test-workspace'

function fakeStat(size: number, mtime?: Date) {
  return {
    size,
    mtime: mtime ?? new Date('2026-03-01T12:00:00.000Z'),
    isFile: () => true,
  }
}

// ── validateMemoryPath ──────────────────────────────────────────

describe('validateMemoryPath', () => {
  it('accepts MEMORY.md', () => {
    expect(() => validateMemoryPath('MEMORY.md')).not.toThrow()
  })

  it('accepts memory/team-memory.md', () => {
    expect(() => validateMemoryPath('memory/team-memory.md')).not.toThrow()
  })

  it('accepts memory/team-intel.json', () => {
    expect(() => validateMemoryPath('memory/team-intel.json')).not.toThrow()
  })

  it('accepts memory/2026-03-01.md', () => {
    expect(() => validateMemoryPath('memory/2026-03-01.md')).not.toThrow()
  })

  it('accepts memory/file_with_underscores.md', () => {
    expect(() => validateMemoryPath('memory/file_with_underscores.md')).not.toThrow()
  })

  it('rejects ../etc/passwd', () => {
    expect(() => validateMemoryPath('../etc/passwd')).toThrow(PathValidationError)
  })

  it('rejects /etc/passwd', () => {
    expect(() => validateMemoryPath('/etc/passwd')).toThrow(PathValidationError)
  })

  it('rejects memory/sub/file.md (nested subdirectory)', () => {
    expect(() => validateMemoryPath('memory/sub/file.md')).toThrow(PathValidationError)
  })

  it('rejects memory/file.sh (disallowed extension)', () => {
    expect(() => validateMemoryPath('memory/file.sh')).toThrow(PathValidationError)
  })

  it('rejects empty string', () => {
    expect(() => validateMemoryPath('')).toThrow(PathValidationError)
  })

  it('rejects memory/file.name.md (dots in name)', () => {
    expect(() => validateMemoryPath('memory/file.name.md')).toThrow(PathValidationError)
  })

  it('rejects memory/.hidden.md', () => {
    expect(() => validateMemoryPath('memory/.hidden.md')).toThrow(PathValidationError)
  })

  it('rejects memory/file.MD (wrong case extension)', () => {
    expect(() => validateMemoryPath('memory/file.MD')).toThrow(PathValidationError)
  })
})

// ── resolveMemoryPath ───────────────────────────────────────────

describe('resolveMemoryPath', () => {
  it('resolves correctly within workspace', () => {
    const result = resolveMemoryPath(WS, 'MEMORY.md')
    expect(result).toBe(`${WS}/MEMORY.md`)
  })

  it('resolves memory/ subdirectory path', () => {
    const result = resolveMemoryPath(WS, 'memory/team-memory.md')
    expect(result).toBe(`${WS}/memory/team-memory.md`)
  })

  it('throws on traversal via ..', () => {
    expect(() => resolveMemoryPath(WS, '../outside.md')).toThrow(PathValidationError)
  })

  it('does not escape workspace for absolute-looking relative paths', () => {
    // path.join handles absolute second arg by keeping it relative
    const result = resolveMemoryPath(WS, '/etc/passwd')
    expect(result).toBe(`${WS}/etc/passwd`)
  })
})

// ── snapshotFile ────────────────────────────────────────────────

describe('snapshotFile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('runs git add + commit', () => {
    snapshotFile(`${WS}/MEMORY.md`, WS)
    expect(mockExecSync).toHaveBeenCalledTimes(2)
    expect(mockExecSync).toHaveBeenCalledWith(
      `git add "${WS}/MEMORY.md"`,
      expect.objectContaining({ cwd: WS })
    )
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('git commit'),
      expect.objectContaining({ cwd: WS })
    )
  })

  it('does not throw when git add fails', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not a git repo') })
    expect(() => snapshotFile(`${WS}/MEMORY.md`, WS)).not.toThrow()
  })

  it('does not throw when git commit fails', () => {
    mockExecSync
      .mockImplementationOnce(() => '') // git add succeeds
      .mockImplementationOnce(() => { throw new Error('nothing to commit') })
    expect(() => snapshotFile(`${WS}/MEMORY.md`, WS)).not.toThrow()
  })
})

// ── normalizeContent ────────────────────────────────────────────

describe('normalizeContent', () => {
  it('strips BOM', () => {
    const result = normalizeContent('\uFEFF# Hello')
    expect(result).toBe('# Hello\n')
    expect(result.charCodeAt(0)).not.toBe(0xfeff)
  })

  it('converts CRLF to LF', () => {
    const result = normalizeContent('line1\r\nline2\r\n')
    expect(result).toBe('line1\nline2\n')
    expect(result).not.toContain('\r')
  })

  it('ensures trailing newline', () => {
    const result = normalizeContent('no trailing newline')
    expect(result).toBe('no trailing newline\n')
  })

  it('does not double trailing newline', () => {
    const result = normalizeContent('already has newline\n')
    expect(result).toBe('already has newline\n')
  })

  it('handles empty string', () => {
    const result = normalizeContent('')
    expect(result).toBe('')
  })

  it('handles BOM + CRLF + no trailing newline together', () => {
    const result = normalizeContent('\uFEFFline1\r\nline2')
    expect(result).toBe('line1\nline2\n')
  })
})

// ── writeMemoryFile ─────────────────────────────────────────────

describe('writeMemoryFile', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
    vi.stubEnv('WORKSPACE_PATH', WS)
  })

  it('writes file successfully', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(fakeStat(100))

    const result = writeMemoryFile('MEMORY.md', '# Updated')
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      `${WS}/MEMORY.md.clawport-tmp`,
      '# Updated\n',
      'utf-8'
    )
    expect(mockRenameSync).toHaveBeenCalledWith(
      `${WS}/MEMORY.md.clawport-tmp`,
      `${WS}/MEMORY.md`
    )
    expect(result.lastModified).toBeDefined()
    expect(result.sizeBytes).toBe(100)
  })

  it('throws PathValidationError for invalid path', () => {
    expect(() => writeMemoryFile('../etc/passwd', 'evil')).toThrow(PathValidationError)
  })

  it('throws ENOENT for nonexistent file', () => {
    mockExistsSync.mockReturnValue(false)
    try {
      writeMemoryFile('MEMORY.md', 'content')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT')
    }
  })

  it('throws E2BIG for oversized content', () => {
    mockExistsSync.mockReturnValue(true)
    const huge = 'x'.repeat(1024 * 1024 + 1)
    try {
      writeMemoryFile('MEMORY.md', huge)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe('E2BIG')
    }
  })

  it('throws ECONFLICT on mtime mismatch', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(fakeStat(100, new Date('2026-03-01T12:00:00.000Z')))
    try {
      writeMemoryFile('MEMORY.md', 'content', '2026-02-28T12:00:00.000Z')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe('ECONFLICT')
    }
  })

  it('passes mtime check when timestamps match', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(fakeStat(100, new Date('2026-03-01T12:00:00.000Z')))

    const result = writeMemoryFile('MEMORY.md', 'content', '2026-03-01T12:00:00.000Z')
    expect(result).toBeDefined()
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  it('normalizes content before writing', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(fakeStat(100))

    writeMemoryFile('MEMORY.md', '\uFEFFline1\r\nline2')
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      'line1\nline2\n',
      'utf-8'
    )
  })

  it('calls snapshotFile before writing (non-fatal on git failure)', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(fakeStat(100))
    mockExecSync.mockImplementation(() => { throw new Error('not a git repo') })

    // Should not throw even when git fails
    const result = writeMemoryFile('MEMORY.md', 'content')
    expect(result).toBeDefined()
    expect(mockWriteFileSync).toHaveBeenCalled()
  })

  it('throws when WORKSPACE_PATH is missing', () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    expect(() => writeMemoryFile('MEMORY.md', 'content')).toThrow('Missing required environment variable')
  })
})
