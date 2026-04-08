/**
 * Server-only pipeline loader — reads pipeline definitions from
 * $WORKSPACE_PATH/clawport/pipelines.json when available.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Pipeline } from './cron-pipelines'

/** Load pipelines from workspace config. Returns [] if not configured. */
export function loadPipelines(): Pipeline[] {
  const workspacePath = process.env.WORKSPACE_PATH
  if (!workspacePath) return []

  const pipelinesPath = join(workspacePath, 'clawport', 'pipelines.json')
  if (!existsSync(pipelinesPath)) return []

  try {
    const raw = readFileSync(pipelinesPath, 'utf-8')
    return JSON.parse(raw) as Pipeline[]
  } catch {
    return []
  }
}
