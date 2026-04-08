import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'

/** Serializable chat message (no isStreaming — UI-only field) */
export interface StoredChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** Derive the chats directory from WORKSPACE_PATH */
function getChatsDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'kanban', 'chats')
}

/**
 * Parse a single JSONL line into a StoredChatMessage.
 * Returns null if the line can't be parsed or is missing required fields.
 */
function parseLine(line: string): StoredChatMessage | null {
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
 * Read chat messages for a ticket from its JSONL file.
 * Returns StoredChatMessage[] sorted oldest-first by timestamp.
 */
export function getChatMessages(ticketId: string): StoredChatMessage[] {
  const chatsDir = getChatsDir()
  const filePath = path.join(chatsDir, `${ticketId}.jsonl`)

  if (!existsSync(filePath)) return []

  try {
    const content = readFileSync(filePath, 'utf-8')
    const messages: StoredChatMessage[] = []
    for (const line of content.split('\n')) {
      const msg = parseLine(line)
      if (msg) messages.push(msg)
    }
    messages.sort((a, b) => a.timestamp - b.timestamp)
    return messages
  } catch {
    return []
  }
}

/**
 * Append chat messages to a ticket's JSONL file.
 * Creates the chats directory and file if they don't exist.
 * Deduplicates by message ID to prevent duplicates on retry.
 */
export function appendChatMessages(ticketId: string, messages: StoredChatMessage[]): void {
  const chatsDir = getChatsDir()
  mkdirSync(chatsDir, { recursive: true })

  const filePath = path.join(chatsDir, `${ticketId}.jsonl`)

  // Deduplicate against existing messages if file exists
  let newMessages = messages
  if (existsSync(filePath)) {
    const existing = getChatMessages(ticketId)
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
