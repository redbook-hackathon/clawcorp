// Validation for chat API messages — supports both plain text and multimodal (vision) content

export type TextContentPart = { type: 'text'; text: string }
export type ImageContentPart = { type: 'image_url'; image_url: { url: string } }
export type ContentPart = TextContentPart | ImageContentPart

export type MessageContent = string | ContentPart[]

export interface ApiMessage {
  role: 'user' | 'assistant' | 'system'
  content: MessageContent
}

function isValidContentPart(part: unknown): part is ContentPart {
  if (typeof part !== 'object' || part === null) return false
  const p = part as Record<string, unknown>

  if (p.type === 'text') {
    return typeof p.text === 'string'
  }

  if (p.type === 'image_url') {
    const imgUrl = p.image_url
    if (typeof imgUrl !== 'object' || imgUrl === null) return false
    return typeof (imgUrl as Record<string, unknown>).url === 'string'
  }

  return false
}

function isValidContent(content: unknown): content is MessageContent {
  if (typeof content === 'string') return true

  if (Array.isArray(content)) {
    return content.length > 0 && content.every(isValidContentPart)
  }

  return false
}

export function validateMessages(messages: unknown): ApiMessage[] {
  if (!Array.isArray(messages)) {
    throw new Error('messages must be an array')
  }

  return messages.map((msg, i) => {
    if (typeof msg !== 'object' || msg === null) {
      throw new Error(`messages[${i}] must be an object`)
    }

    const m = msg as Record<string, unknown>

    if (typeof m.role !== 'string' || !['user', 'assistant', 'system'].includes(m.role)) {
      throw new Error(`messages[${i}].role must be "user", "assistant", or "system"`)
    }

    if (!isValidContent(m.content)) {
      throw new Error(`messages[${i}].content must be a string or array of content parts`)
    }

    return { role: m.role as ApiMessage['role'], content: m.content as MessageContent }
  })
}

// Legacy export for backward compatibility with existing test
export type ValidatedChatMessage = ApiMessage
export type ValidationResult = { ok: true; messages: ApiMessage[] } | { ok: false; error: string }

export function validateChatMessages(body: unknown): ValidationResult {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }
  const { messages } = body as Record<string, unknown>
  try {
    const validated = validateMessages(messages)
    return { ok: true, messages: validated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid messages' }
  }
}
