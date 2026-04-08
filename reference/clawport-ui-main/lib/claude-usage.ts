import { execSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { ClaudeCodeUsage } from '@/lib/types'

const ANTHROPIC_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const CACHE_PATH = join(process.env.HOME ?? '/tmp', '.cache', 'clawport-ui', 'usage.json')
const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 5000, 10000] // escalating backoffs

function readCache(): ClaudeCodeUsage | null {
  try {
    const data: ClaudeCodeUsage = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
    if (data.fiveHour.utilization === 0 && data.sevenDay.utilization === 0) return null
    return data
  } catch {
    return null
  }
}

function writeCache(usage: ClaudeCodeUsage): void {
  if (usage.fiveHour.utilization === 0 && usage.sevenDay.utilization === 0) return
  try {
    mkdirSync(join(process.env.HOME ?? '/tmp', '.cache', 'clawport-ui'), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify(usage))
  } catch { /* best effort */ }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Read the Claude Code OAuth token from the macOS Keychain.
 */
export function getKeychainToken(): string | null {
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim()
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const token = parsed?.claudeAiOauth?.accessToken
    return typeof token === 'string' && token.length > 0 ? token : null
  } catch {
    return null
  }
}

/**
 * Fetch Claude Code subscription usage (five-hour window + seven-day cap).
 * Retries on 429 with backoff. Falls back to disk cache on failure.
 * Returns null when no real utilization data is available.
 */
export async function fetchClaudeCodeUsage(): Promise<ClaudeCodeUsage | null> {
  const token = getKeychainToken()
  if (!token) return null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_USAGE_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'anthropic-beta': 'oauth-2025-04-20',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (res.status === 429 && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt])
        continue
      }
      if (!res.ok) return readCache()

      const data = await res.json()

      const usage: ClaudeCodeUsage = {
        fiveHour: {
          utilization: data.five_hour?.utilization ?? 0,
          resetsAt: data.five_hour?.resets_at ?? null,
        },
        sevenDay: {
          utilization: data.seven_day?.utilization ?? 0,
          resetsAt: data.seven_day?.resets_at ?? null,
        },
      }

      writeCache(usage)
      return usage
    } catch {
      return readCache()
    }
  }

  return readCache()
}
