import { existsSync, statSync, writeFileSync, renameSync } from 'fs'
import { join, resolve } from 'path'
import { execSync } from 'child_process'
import { requireEnv } from '@/lib/env'

// ── Path validation ─────────────────────────────────────────────

/**
 * Allowlist for editable memory file paths.
 * Matches: MEMORY.md, memory/<name>.md, memory/<name>.json
 * Names: alphanumeric, hyphens, underscores (no dots except extension).
 */
const MEMORY_PATH_RE = /^(?:MEMORY\.md|memory\/[a-zA-Z0-9_-]+\.(?:md|json))$/

export function validateMemoryPath(relativePath: string): void {
  if (!relativePath || !MEMORY_PATH_RE.test(relativePath)) {
    throw new PathValidationError(
      `Invalid memory path: "${relativePath}". Must match MEMORY.md or memory/<name>.md|json`
    )
  }
}

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathValidationError'
  }
}

// ── Path resolution ─────────────────────────────────────────────

/**
 * Resolve a relative memory path to an absolute path within the workspace.
 * Defense-in-depth: verifies the resolved path is inside the workspace
 * even after validateMemoryPath passes (protects against symlink attacks, etc).
 */
export function resolveMemoryPath(workspacePath: string, relativePath: string): string {
  const absPath = resolve(join(workspacePath, relativePath))
  const normalizedWorkspace = resolve(workspacePath)

  if (!absPath.startsWith(normalizedWorkspace + '/') && absPath !== normalizedWorkspace) {
    throw new PathValidationError(
      `Path traversal detected: "${relativePath}" resolves outside workspace`
    )
  }

  return absPath
}

// ── Git snapshot ────────────────────────────────────────────────

/**
 * Create a git snapshot of the file before overwriting.
 * Non-fatal: if git is not available or the workspace is not a git repo,
 * the write still proceeds.
 */
export function snapshotFile(absPath: string, workspacePath: string): void {
  try {
    execSync(`git add "${absPath}"`, {
      cwd: workspacePath,
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    execSync(`git commit -m "clawport: snapshot before edit" --allow-empty`, {
      cwd: workspacePath,
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // Non-fatal -- git may not be available or no changes to commit
  }
}

// ── Content normalization ───────────────────────────────────────

/**
 * Normalize content before writing:
 * - Strip BOM (U+FEFF)
 * - Convert CRLF → LF
 * - Ensure trailing newline
 */
export function normalizeContent(content: string): string {
  let normalized = content
  // Strip BOM
  if (normalized.charCodeAt(0) === 0xfeff) {
    normalized = normalized.slice(1)
  }
  // CRLF → LF
  normalized = normalized.replace(/\r\n/g, '\n')
  // Ensure trailing newline (unless empty)
  if (normalized.length > 0 && !normalized.endsWith('\n')) {
    normalized += '\n'
  }
  return normalized
}

// ── Atomic write ────────────────────────────────────────────────

/**
 * Full write flow for the PUT /api/memory handler.
 * Returns { lastModified, sizeBytes } on success.
 */
export function writeMemoryFile(
  relativePath: string,
  content: string,
  expectedLastModified?: string
): { lastModified: string; sizeBytes: number } {
  // 1. Validate path format
  validateMemoryPath(relativePath)

  // 2. Resolve + verify inside workspace
  const workspacePath = requireEnv('WORKSPACE_PATH')
  const absPath = resolveMemoryPath(workspacePath, relativePath)

  // 3. File must exist (no creating files via edit)
  if (!existsSync(absPath)) {
    const err = new Error(`File not found: ${relativePath}`)
    ;(err as NodeJS.ErrnoException).code = 'ENOENT'
    throw err
  }

  // 4. Content validation
  if (typeof content !== 'string') {
    const err = new Error('Content must be a string')
    ;(err as NodeJS.ErrnoException).code = 'EINVAL'
    throw err
  }
  const MAX_SIZE = 1024 * 1024 // 1MB
  if (content.length > MAX_SIZE) {
    const err = new Error(`Content too large (${content.length} bytes, max ${MAX_SIZE})`)
    ;(err as NodeJS.ErrnoException).code = 'E2BIG'
    throw err
  }

  // 5. Conflict detection: compare mtime
  if (expectedLastModified) {
    const stat = statSync(absPath)
    if (stat.mtime.toISOString() !== expectedLastModified) {
      const err = new Error('File was modified by another process')
      ;(err as NodeJS.ErrnoException).code = 'ECONFLICT'
      throw err
    }
  }

  // 6. Git snapshot before write (non-fatal)
  snapshotFile(absPath, workspacePath)

  // 7. Normalize content
  const normalized = normalizeContent(content)

  // 8. Atomic write: temp file + rename
  const tmpPath = absPath + '.clawport-tmp'
  writeFileSync(tmpPath, normalized, 'utf-8')
  renameSync(tmpPath, absPath)

  // 9. Return new metadata
  const newStat = statSync(absPath)
  return {
    lastModified: newStat.mtime.toISOString(),
    sizeBytes: newStat.size,
  }
}
