import { describe, it, expect } from 'vitest'
import { validateMessages, validateChatMessages } from './validation'

// --- validateMessages ---

describe('validateMessages', () => {
  it('accepts plain text messages', () => {
    const result = validateMessages([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('hello')
  })

  it('accepts multimodal content array with text parts', () => {
    const result = validateMessages([
      { role: 'user', content: [{ type: 'text', text: 'describe this' }] },
    ])
    expect(result).toHaveLength(1)
    expect(Array.isArray(result[0].content)).toBe(true)
  })

  it('accepts image_url content parts', () => {
    const result = validateMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
        ],
      },
    ])
    expect(result).toHaveLength(1)
    const parts = result[0].content as Array<{ type: string }>
    expect(parts).toHaveLength(2)
    expect(parts[1].type).toBe('image_url')
  })

  it('accepts system role messages', () => {
    const result = validateMessages([
      { role: 'system', content: 'You are helpful.' },
    ])
    expect(result[0].role).toBe('system')
  })

  it('throws on non-array input', () => {
    expect(() => validateMessages('not an array')).toThrow('must be an array')
  })

  it('throws on invalid role', () => {
    expect(() => validateMessages([{ role: 'admin', content: 'hi' }])).toThrow('role')
  })

  it('throws on missing content', () => {
    expect(() => validateMessages([{ role: 'user' }])).toThrow('content')
  })

  it('throws on number content', () => {
    expect(() => validateMessages([{ role: 'user', content: 42 }])).toThrow('content')
  })

  it('throws on empty content array', () => {
    expect(() => validateMessages([{ role: 'user', content: [] }])).toThrow('content')
  })

  it('throws on malformed content part (missing type)', () => {
    expect(() => validateMessages([
      { role: 'user', content: [{ text: 'no type field' }] },
    ])).toThrow('content')
  })

  it('throws on invalid content part type', () => {
    expect(() => validateMessages([
      { role: 'user', content: [{ type: 'video', url: 'x' }] },
    ])).toThrow('content')
  })

  it('throws on image_url part without url string', () => {
    expect(() => validateMessages([
      { role: 'user', content: [{ type: 'image_url', image_url: {} }] },
    ])).toThrow('content')
  })

  it('throws on text part without text string', () => {
    expect(() => validateMessages([
      { role: 'user', content: [{ type: 'text', text: 123 }] },
    ])).toThrow('content')
  })

  it('throws on non-object message', () => {
    expect(() => validateMessages([null])).toThrow('must be an object')
    expect(() => validateMessages(['string'])).toThrow('must be an object')
  })
})

// --- validateChatMessages (legacy wrapper) ---

describe('validateChatMessages', () => {
  it('returns ok:true with validated messages', () => {
    const result = validateChatMessages({
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.messages).toHaveLength(1)
    }
  })

  it('returns ok:false for non-object body', () => {
    const result = validateChatMessages(null)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false for invalid messages', () => {
    const result = validateChatMessages({ messages: 'not an array' })
    expect(result.ok).toBe(false)
  })

  it('accepts multimodal messages through legacy wrapper', () => {
    const result = validateChatMessages({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'check this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,x' } },
        ],
      }],
    })
    expect(result.ok).toBe(true)
  })
})
