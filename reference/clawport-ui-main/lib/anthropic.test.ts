// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  hasImageContent,
  extractImageAttachments,
  buildTextPrompt,
  sendViaOpenClaw,
  execCli,
} from './anthropic'
import type { ApiMessage } from './validation'

// --- hasImageContent ---

describe('hasImageContent', () => {
  it('returns false for plain text messages', () => {
    const msgs: ApiMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]
    expect(hasImageContent(msgs)).toBe(false)
  })

  it('returns true when any message has image_url parts', () => {
    const msgs: ApiMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
        ],
      },
    ]
    expect(hasImageContent(msgs)).toBe(true)
  })

  it('returns false when content array has only text parts', () => {
    const msgs: ApiMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'just text in array form' },
        ],
      },
    ]
    expect(hasImageContent(msgs)).toBe(false)
  })

  it('returns true even if only one message out of many has images', () => {
    const msgs: ApiMessage[] = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'reply' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look at this' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,xyz' } },
        ],
      },
    ]
    expect(hasImageContent(msgs)).toBe(true)
  })
})

// --- extractImageAttachments ---

describe('extractImageAttachments', () => {
  it('extracts base64 data and mimeType from data URL', () => {
    const msgs: ApiMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'describe' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAA' } },
        ],
      },
    ]
    const result = extractImageAttachments(msgs)
    expect(result).toEqual([
      { mimeType: 'image/png', content: 'iVBORw0KGgoAAAA' },
    ])
  })

  it('extracts multiple images from a single message', () => {
    const msgs: ApiMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'compare' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } },
        ],
      },
    ]
    const result = extractImageAttachments(msgs)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ mimeType: 'image/png', content: 'AAA' })
    expect(result[1]).toEqual({ mimeType: 'image/jpeg', content: 'BBB' })
  })

  it('extracts images from multiple messages', () => {
    const msgs: ApiMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'data:image/png;base64,FIRST' } },
        ],
      },
      { role: 'assistant', content: 'I see it' },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'data:image/webp;base64,SECOND' } },
        ],
      },
    ]
    const result = extractImageAttachments(msgs)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('FIRST')
    expect(result[1].content).toBe('SECOND')
  })

  it('returns empty array when no images', () => {
    const msgs: ApiMessage[] = [
      { role: 'user', content: 'just text' },
    ]
    expect(extractImageAttachments(msgs)).toEqual([])
  })

  it('defaults to image/png for non-data URLs', () => {
    const msgs: ApiMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
        ],
      },
    ]
    const result = extractImageAttachments(msgs)
    expect(result[0].mimeType).toBe('image/png')
  })
})

// --- buildTextPrompt ---

describe('buildTextPrompt', () => {
  it('combines system prompt and conversation history', () => {
    const msgs: ApiMessage[] = [
      { role: 'user', content: 'what is this?' },
    ]
    const result = buildTextPrompt('You are helpful.', msgs)
    expect(result).toContain('You are helpful.')
    expect(result).toContain('what is this?')
  })

  it('includes all user and assistant messages', () => {
    const msgs: ApiMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'describe the image' },
    ]
    const result = buildTextPrompt('system prompt', msgs)
    expect(result).toContain('hello')
    expect(result).toContain('hi there')
    expect(result).toContain('describe the image')
  })

  it('extracts text from content part arrays', () => {
    const msgs: ApiMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what do you see?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,xxx' } },
        ],
      },
    ]
    const result = buildTextPrompt('', msgs)
    expect(result).toContain('what do you see?')
    expect(result).not.toContain('data:image')
  })

  it('skips system role messages from the messages array', () => {
    const msgs: ApiMessage[] = [
      { role: 'system', content: 'extra system' },
      { role: 'user', content: 'question' },
    ]
    const result = buildTextPrompt('main system', msgs)
    expect(result).toContain('main system')
    expect(result).toContain('question')
    expect(result).not.toContain('extra system')
  })
})

// --- execCli ---

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

import { execFile as mockExecFile } from 'child_process'

describe('execCli', () => {
  beforeEach(() => {
    vi.mocked(mockExecFile).mockReset()
  })

  it('returns stdout on success', async () => {
    vi.mocked(mockExecFile).mockImplementation((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null, stdout: string, stderr: string) => void)(null, 'output', '')
      return {} as ReturnType<typeof mockExecFile>
    })
    const result = await execCli('/usr/bin/openclaw', ['arg1'], 5000)
    expect(result).toBe('output')
  })

  it('returns null on error', async () => {
    vi.mocked(mockExecFile).mockImplementation((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null, stdout: string, stderr: string) => void)(new Error('fail'), '', '')
      return {} as ReturnType<typeof mockExecFile>
    })
    const result = await execCli('/usr/bin/openclaw', ['arg1'], 5000)
    expect(result).toBeNull()
  })
})

// --- sendViaOpenClaw ---

describe('sendViaOpenClaw', () => {
  beforeEach(() => {
    vi.stubEnv('OPENCLAW_BIN', '/usr/bin/openclaw')
    vi.mocked(mockExecFile).mockReset()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('sends chat.send then polls chat.history for response', async () => {
    let callCount = 0
    vi.mocked(mockExecFile).mockImplementation((_cmd, args, _opts, cb) => {
      callCount++
      const argsArr = args as string[]

      if (argsArr.includes('chat.send')) {
        // Step 1: send returns started
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          JSON.stringify({ runId: 'run-1', status: 'started' }),
          ''
        )
      } else if (argsArr.includes('chat.history')) {
        if (callCount <= 2) {
          // First poll: still processing (last msg is user)
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            null,
            JSON.stringify({
              messages: [
                { role: 'user', content: [{ type: 'text', text: 'describe' }], timestamp: Date.now() },
              ],
            }),
            ''
          )
        } else {
          // Second poll: assistant responded
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            null,
            JSON.stringify({
              messages: [
                { role: 'user', content: [{ type: 'text', text: 'describe' }], timestamp: Date.now() },
                {
                  role: 'assistant',
                  content: [
                    { type: 'thinking', thinking: 'analyzing...' },
                    { type: 'text', text: 'I see a Discord bot profile for Jarvis.' },
                  ],
                  timestamp: Date.now(),
                },
              ],
            }),
            ''
          )
        }
      }
      return {} as ReturnType<typeof mockExecFile>
    })

    const result = await sendViaOpenClaw({
      gatewayToken: 'test-token',
      message: 'describe this image',
      attachments: [{ mimeType: 'image/png', content: 'base64data' }],
    })

    expect(result).toBe('I see a Discord bot profile for Jarvis.')
    // Should have called: 1 send + at least 2 history polls
    expect(callCount).toBeGreaterThanOrEqual(3)
  })

  it('returns null when chat.send fails', async () => {
    vi.mocked(mockExecFile).mockImplementation((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null, stdout: string, stderr: string) => void)(
        new Error('spawn E2BIG'),
        '',
        ''
      )
      return {} as ReturnType<typeof mockExecFile>
    })

    const result = await sendViaOpenClaw({
      gatewayToken: 'test-token',
      message: 'test',
      attachments: [],
    })

    expect(result).toBeNull()
  })

  it('returns null when send response is unexpected', async () => {
    vi.mocked(mockExecFile).mockImplementation((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null, stdout: string, stderr: string) => void)(
        null,
        JSON.stringify({ error: 'bad request' }),
        ''
      )
      return {} as ReturnType<typeof mockExecFile>
    })

    const result = await sendViaOpenClaw({
      gatewayToken: 'test-token',
      message: 'test',
      attachments: [],
    })

    expect(result).toBeNull()
  })

  it('passes correct params to chat.send', async () => {
    vi.mocked(mockExecFile).mockImplementation((_cmd, args, _opts, cb) => {
      const argsArr = args as string[]
      if (argsArr.includes('chat.send')) {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          JSON.stringify({ runId: 'r1', status: 'started' }),
          ''
        )
      } else {
        // Return assistant response immediately
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          JSON.stringify({
            messages: [{
              role: 'assistant',
              content: [{ type: 'text', text: 'ok' }],
              timestamp: Date.now(),
            }],
          }),
          ''
        )
      }
      return {} as ReturnType<typeof mockExecFile>
    })

    await sendViaOpenClaw({
      gatewayToken: 'my-token',
      message: 'describe this',
      attachments: [{ mimeType: 'image/jpeg', content: 'imgdata' }],
      sessionKey: 'custom:session',
    })

    // Find the chat.send call
    const sendCall = vi.mocked(mockExecFile).mock.calls.find(
      c => (c[1] as string[]).includes('chat.send')
    )
    expect(sendCall).toBeTruthy()
    const [bin, args] = sendCall!
    expect(bin).toBe('/usr/bin/openclaw')
    expect(args).toContain('--token')
    expect(args).toContain('my-token')

    const paramsIdx = (args as string[]).indexOf('--params')
    const paramsJson = JSON.parse((args as string[])[paramsIdx + 1])
    expect(paramsJson.sessionKey).toBe('custom:session')
    expect(paramsJson.message).toBe('describe this')
    expect(paramsJson.attachments).toHaveLength(1)
    expect(paramsJson.attachments[0].mimeType).toBe('image/jpeg')
  })

  it('handles string content in assistant response', async () => {
    vi.mocked(mockExecFile).mockImplementation((_cmd, args, _opts, cb) => {
      const argsArr = args as string[]
      if (argsArr.includes('chat.send')) {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          JSON.stringify({ runId: 'r1', status: 'started' }),
          ''
        )
      } else {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          JSON.stringify({
            messages: [{
              role: 'assistant',
              content: 'plain string response',
              timestamp: Date.now(),
            }],
          }),
          ''
        )
      }
      return {} as ReturnType<typeof mockExecFile>
    })

    const result = await sendViaOpenClaw({
      gatewayToken: 'tok',
      message: 'hi',
      attachments: [],
    })

    expect(result).toBe('plain string response')
  })
})
