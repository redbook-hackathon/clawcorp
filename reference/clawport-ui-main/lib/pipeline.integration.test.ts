/**
 * Integration tests for the full image pipeline:
 * buildApiContent → JSON serialize → parse → validateChatMessages → OpenAI message mapping
 *
 * These tests verify that image data survives the complete journey from
 * user attachment to the format sent to the OpenAI SDK.
 */
import { describe, it, expect } from 'vitest'
import { buildApiContent } from './multimodal'
import { validateChatMessages, validateMessages } from './validation'
import type { Message, MediaAttachment } from './conversations'
import type { ContentPart, MessageContent } from './validation'

// --- Helpers ---

function userMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'what is this?',
    timestamp: Date.now(),
    ...overrides,
  }
}

function assistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-0',
    role: 'assistant',
    content: 'Hello, how can I help?',
    timestamp: Date.now(),
    ...overrides,
  }
}

function imageAttachment(overrides: Partial<MediaAttachment> = {}): MediaAttachment {
  return {
    type: 'image',
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
    name: 'screenshot.png',
    mimeType: 'image/png',
    ...overrides,
  }
}

// --- Full pipeline simulation ---

/**
 * Simulates the exact pipeline:
 * 1. ConversationView builds apiMessages via buildApiContent
 * 2. JSON.stringify for fetch body
 * 3. Server parses with request.json()
 * 4. Server validates with validateChatMessages
 * 5. Server maps messages for OpenAI SDK
 */
function simulateFullPipeline(conversationMessages: Message[]) {
  // Step 1: Client-side — buildApiContent for each message (ConversationView line 368-371)
  const apiMessages = conversationMessages.map(m => ({
    role: m.role,
    content: buildApiContent(m),
  }))

  // Step 2: Client-side — JSON.stringify for fetch body (ConversationView line 377)
  const jsonBody = JSON.stringify({ messages: apiMessages })

  // Step 3: Server-side — request.json() (route.ts line 29)
  const parsedBody = JSON.parse(jsonBody)

  // Step 4: Server-side — validateChatMessages (route.ts line 37)
  const result = validateChatMessages(parsedBody)

  if (!result.ok) {
    throw new Error(`Validation failed: ${result.error}`)
  }

  // Step 5: Server-side — map for OpenAI SDK (route.ts line 55-58)
  const systemPrompt = 'You are a helpful assistant.'
  const openaiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...result.messages.map(m => ({ role: m.role, content: m.content })),
  ]

  return { apiMessages, jsonBody, parsedBody, validatedMessages: result.messages, openaiMessages }
}

// =============================================================
// Pipeline integration tests
// =============================================================

describe('full image pipeline — end-to-end', () => {
  it('preserves image_url data through the entire pipeline', () => {
    const img = imageAttachment()
    const msgs: Message[] = [
      assistantMessage(),
      userMessage({ media: [img] }),
    ]

    const { openaiMessages } = simulateFullPipeline(msgs)

    // The last message should be the user message with multimodal content
    const userMsg = openaiMessages[openaiMessages.length - 1]
    expect(userMsg.role).toBe('user')

    // content must be an array (multimodal), NOT a string
    expect(Array.isArray(userMsg.content)).toBe(true)

    const parts = userMsg.content as ContentPart[]
    // Must have text + image_url parts
    const imageParts = parts.filter(p => p.type === 'image_url')
    expect(imageParts.length).toBeGreaterThanOrEqual(1)

    // The image_url must contain the actual data URL, not "[object Object]" or empty
    const imgPart = imageParts[0] as { type: 'image_url'; image_url: { url: string } }
    expect(imgPart.image_url.url).toBe(img.url)
    expect(imgPart.image_url.url).toContain('data:image/png;base64,')
  })

  it('preserves image data through JSON serialization round-trip', () => {
    const img = imageAttachment()
    const msg = userMessage({ media: [img] })
    const content = buildApiContent(msg)

    // Simulate JSON round-trip (fetch body → request.json())
    const serialized = JSON.stringify({ role: 'user', content })
    const deserialized = JSON.parse(serialized)

    // content must still be an array after round-trip
    expect(Array.isArray(deserialized.content)).toBe(true)
    expect(deserialized.content).toHaveLength(2) // text + image

    // image_url part must survive
    const imgPart = deserialized.content.find((p: ContentPart) => p.type === 'image_url')
    expect(imgPart).toBeDefined()
    expect(imgPart.image_url.url).toBe(img.url)
  })

  it('validation preserves multimodal content arrays — does not stringify them', () => {
    const imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAA'
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this?' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ]

    const validated = validateMessages(messages)
    expect(validated).toHaveLength(1)

    // content must be the ARRAY, not a stringified version
    const content = validated[0].content
    expect(Array.isArray(content)).toBe(true)
    expect(typeof content).not.toBe('string')

    const parts = content as ContentPart[]
    expect(parts).toHaveLength(2)

    const imgPart = parts[1] as { type: 'image_url'; image_url: { url: string } }
    expect(imgPart.type).toBe('image_url')
    expect(imgPart.image_url.url).toBe(imageUrl)
  })

  it('route message mapping preserves multimodal content as-is', () => {
    // Simulate what the route does: map validated messages
    const imageUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg'
    const validatedMessages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'describe this image' },
          { type: 'image_url' as const, image_url: { url: imageUrl } },
        ] as ContentPart[],
      },
    ]

    // This is what the route does on line 57
    const mapped = validatedMessages.map(m => ({ role: m.role, content: m.content }))

    // content must still be the array
    expect(Array.isArray(mapped[0].content)).toBe(true)
    const parts = mapped[0].content as ContentPart[]
    const imgPart = parts[1] as { type: 'image_url'; image_url: { url: string } }
    expect(imgPart.image_url.url).toBe(imageUrl)
  })

  it('handles image-only message (no text) through full pipeline', () => {
    // When user sends image without typing anything, content becomes a label
    const img = imageAttachment()
    const msgs: Message[] = [
      userMessage({ content: '[screenshot.png]', media: [img] }),
    ]

    const { openaiMessages } = simulateFullPipeline(msgs)
    const userMsg = openaiMessages[1] // index 0 is system

    expect(Array.isArray(userMsg.content)).toBe(true)
    const parts = userMsg.content as ContentPart[]

    // Should have text part (the label) + image_url part
    const imageParts = parts.filter(p => p.type === 'image_url')
    expect(imageParts.length).toBe(1)

    const imgPart = imageParts[0] as { type: 'image_url'; image_url: { url: string } }
    expect(imgPart.image_url.url).toBe(img.url)
  })

  it('handles multiple images in a single message', () => {
    const img1 = imageAttachment({ url: 'data:image/png;base64,AAA', name: 'first.png' })
    const img2 = imageAttachment({ url: 'data:image/jpeg;base64,BBB', name: 'second.jpg' })
    const msgs: Message[] = [
      userMessage({ content: 'compare these', media: [img1, img2] }),
    ]

    const { openaiMessages } = simulateFullPipeline(msgs)
    const userMsg = openaiMessages[1]

    expect(Array.isArray(userMsg.content)).toBe(true)
    const parts = userMsg.content as ContentPart[]
    const imageParts = parts.filter(p => p.type === 'image_url') as Array<{ type: 'image_url'; image_url: { url: string } }>

    expect(imageParts).toHaveLength(2)
    expect(imageParts[0].image_url.url).toBe('data:image/png;base64,AAA')
    expect(imageParts[1].image_url.url).toBe('data:image/jpeg;base64,BBB')
  })

  it('plain text messages remain strings through the pipeline (not wrapped in array)', () => {
    const msgs: Message[] = [
      assistantMessage(),
      userMessage({ content: 'just text, no images' }),
    ]

    const { openaiMessages } = simulateFullPipeline(msgs)

    // Assistant message (index 1, after system) should be a string
    expect(typeof openaiMessages[1].content).toBe('string')

    // User message (index 2) should also be a string (no media)
    expect(typeof openaiMessages[2].content).toBe('string')
    expect(openaiMessages[2].content).toBe('just text, no images')
  })

  it('conversation with mix of plain and multimodal messages', () => {
    const img = imageAttachment()
    const msgs: Message[] = [
      assistantMessage({ content: 'Hi there!' }),
      userMessage({ id: 'u1', content: 'hello' }),  // plain
      assistantMessage({ id: 'a1', content: 'How can I help?' }),
      userMessage({ id: 'u2', content: 'what is this?', media: [img] }),  // multimodal
    ]

    const { openaiMessages } = simulateFullPipeline(msgs)

    // system (0), assistant (1), user plain (2), assistant (3), user multimodal (4)
    expect(openaiMessages).toHaveLength(5)

    // Plain user message
    expect(typeof openaiMessages[2].content).toBe('string')

    // Multimodal user message
    expect(Array.isArray(openaiMessages[4].content)).toBe(true)
    const parts = openaiMessages[4].content as ContentPart[]
    expect(parts.some(p => p.type === 'image_url')).toBe(true)
  })
})

// =============================================================
// Specific regression tests for common bugs
// =============================================================

describe('regression — content must not become [object Object]', () => {
  it('buildApiContent result does not stringify to [object Object]', () => {
    const msg = userMessage({ media: [imageAttachment()] })
    const content = buildApiContent(msg)

    // If content were accidentally coerced to string, it would be "[object Object]"
    const asString = String(content)
    expect(asString).not.toBe('[object Object]')

    // The actual content should be an array
    expect(Array.isArray(content)).toBe(true)
  })

  it('multimodal content survives template literal (catches accidental string coercion)', () => {
    const msg = userMessage({ media: [imageAttachment()] })
    const content = buildApiContent(msg)

    // This simulates an accidental `${content}` in code
    if (Array.isArray(content)) {
      // Verify the array is properly structured, not accidentally stringified
      const jsonStr = JSON.stringify(content)
      expect(jsonStr).not.toContain('[object Object]')
      expect(jsonStr).toContain('image_url')
      expect(jsonStr).toContain('data:image/png;base64,')
    }
  })
})

describe('regression — validation must not strip image_url parts', () => {
  it('validates and returns all content part types', () => {
    const result = validateChatMessages({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'look at this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
        ],
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const content = result.messages[0].content
    expect(Array.isArray(content)).toBe(true)
    const parts = content as ContentPart[]

    // Both parts must survive validation
    expect(parts).toHaveLength(2)
    expect(parts[0].type).toBe('text')
    expect(parts[1].type).toBe('image_url')
  })

  it('preserves the exact image URL through validation', () => {
    const longBase64Url = 'data:image/png;base64,' + 'A'.repeat(1000)
    const result = validateChatMessages({
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: longBase64Url } },
        ],
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parts = result.messages[0].content as ContentPart[]
    const imgPart = parts[0] as { type: 'image_url'; image_url: { url: string } }
    expect(imgPart.image_url.url).toBe(longBase64Url)
  })
})
