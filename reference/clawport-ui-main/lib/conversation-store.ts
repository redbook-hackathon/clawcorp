import { readFileSync, appendFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'

/** Serializable conversation message (no isStreaming, media, or system role) */
export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** Maximum messages returned per agent conversation */
const MAX_MESSAGES = 500

const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/

/** Validate agent ID format. Throws on invalid. */
export function validateAgentId(id: string): void {
  if (!AGENT_ID_RE.test(id)) {
    throw new Error(`Invalid agent ID: ${id}`)
  }
}

/** Derive the conversations directory from WORKSPACE_PATH */
function getConversationsDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'conversations')
}

/** Derive the clawport config directory from WORKSPACE_PATH */
function getClawportDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'clawport')
}

/**
 * Parse a single JSONL line into a StoredMessage.
 * Returns null if the line can't be parsed or is missing required fields.
 */
function parseLine(line: string): StoredMessage | null {
  if (!line.trim()) return null
  try {
    const obj = JSON.parse(line)
    if (typeof obj.id !== 'string' || !obj.id) return null
    if (obj.role !== 'user' && obj.role !== 'assistant') return null
    if (typeof obj.content !== 'string') return null
    return {
      id: obj.id,
      role: obj.role,
      content: obj.content,
      timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : 0,
    }
  } catch {
    return null
  }
}

/**
 * Read conversation messages for an agent from its JSONL file.
 * Returns StoredMessage[] sorted oldest-first, capped at MAX_MESSAGES.
 */
export function getMessages(agentId: string): StoredMessage[] {
  validateAgentId(agentId)
  const dir = getConversationsDir()
  const filePath = path.join(dir, `${agentId}.jsonl`)

  if (!existsSync(filePath)) return []

  try {
    const content = readFileSync(filePath, 'utf-8')
    const messages: StoredMessage[] = []
    for (const line of content.split('\n')) {
      const msg = parseLine(line)
      if (msg) messages.push(msg)
    }
    messages.sort((a, b) => a.timestamp - b.timestamp)
    if (messages.length > MAX_MESSAGES) {
      return messages.slice(messages.length - MAX_MESSAGES)
    }
    return messages
  } catch {
    return []
  }
}

/**
 * Append conversation messages to an agent's JSONL file.
 * Creates the directory and file if they don't exist.
 * Deduplicates by message ID to prevent duplicates on retry.
 */
export function appendMessages(agentId: string, messages: StoredMessage[]): void {
  validateAgentId(agentId)
  const dir = getConversationsDir()
  mkdirSync(dir, { recursive: true })

  const filePath = path.join(dir, `${agentId}.jsonl`)

  let newMessages = messages
  if (existsSync(filePath)) {
    const existing = getMessages(agentId)
    const existingIds = new Set(existing.map(m => m.id))
    newMessages = messages.filter(m => !existingIds.has(m.id))
    if (newMessages.length === 0) return
  }
  const lines = newMessages.map(m => JSON.stringify({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }))

  appendFileSync(filePath, lines.join('\n') + '\n', 'utf-8')
}

/** Delete an agent's conversation file. */
export function clearConversation(agentId: string): void {
  validateAgentId(agentId)
  const dir = getConversationsDir()
  const filePath = path.join(dir, `${agentId}.jsonl`)
  try {
    unlinkSync(filePath)
  } catch {
    // File may not exist — that's fine
  }
}

/** List all agent IDs that have stored conversations. */
export function listAgentIds(): string[] {
  const dir = getConversationsDir()
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace(/\.jsonl$/, ''))
  } catch {
    return []
  }
}

/** Check if onboarding has been completed (server-side marker). */
export function isOnboarded(): boolean {
  try {
    const dir = getClawportDir()
    return existsSync(path.join(dir, '.onboarded'))
  } catch {
    return false
  }
}

/** Set or clear the onboarding marker file. */
export function setOnboarded(value: boolean): void {
  const dir = getClawportDir()
  const filePath = path.join(dir, '.onboarded')
  if (value) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(filePath, '1', 'utf-8')
  } else {
    try {
      unlinkSync(filePath)
    } catch {
      // File may not exist
    }
  }
}
