import { NextRequest } from 'next/server'
import { getChatMessages, appendChatMessages, StoredChatMessage } from '@/lib/kanban/chat-store'
import { apiErrorResponse } from '@/lib/api-error'

const TICKET_ID_RE = /^[a-zA-Z0-9_-]+$/

function isValidMessage(m: unknown): m is StoredChatMessage {
  if (!m || typeof m !== 'object') return false
  const msg = m as Record<string, unknown>
  return (
    typeof msg.id === 'string' && msg.id.length > 0 &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    (typeof msg.timestamp === 'number' || msg.timestamp === undefined)
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const { ticketId } = await params
    if (!TICKET_ID_RE.test(ticketId)) {
      return Response.json({ error: 'Invalid ticket ID' }, { status: 400 })
    }
    const messages = getChatMessages(ticketId)
    return Response.json(messages)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load chat history')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const { ticketId } = await params
    if (!TICKET_ID_RE.test(ticketId)) {
      return Response.json({ error: 'Invalid ticket ID' }, { status: 400 })
    }

    const body = await req.json()
    const messages: unknown[] = body.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages array required' }, { status: 400 })
    }

    if (!messages.every(isValidMessage)) {
      return Response.json({ error: 'Invalid message format: each message needs id, role (user|assistant), and content' }, { status: 400 })
    }

    appendChatMessages(ticketId, messages)
    return Response.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save chat history')
  }
}
