// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { transcribeViaApi, transcribe } from './transcribe'

// --- transcribeViaApi ---

describe('transcribeViaApi', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns transcript text on successful API response', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello world' }),
    })

    const blob = new Blob(['fake audio'], { type: 'audio/webm' })
    const result = await transcribeViaApi(blob)
    expect(result).toBe('hello world')
  })

  it('calls /api/transcribe with POST and FormData', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'test' }),
    })

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    await transcribeViaApi(blob)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/transcribe',
      expect.objectContaining({ method: 'POST' })
    )
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[1].body).toBeInstanceOf(FormData)
  })

  it('returns null when API returns non-ok response', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    })

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribeViaApi(blob)
    expect(result).toBeNull()
  })

  it('returns null when API returns empty text', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ text: '' }),
    })

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribeViaApi(blob)
    expect(result).toBeNull()
  })

  it('returns null when API response has no text field', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'no transcript' }),
    })

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribeViaApi(blob)
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribeViaApi(blob)
    expect(result).toBeNull()
  })
})

// --- transcribe (orchestrator) ---

describe('transcribe', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns whisper source when API transcription succeeds', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'transcribed text' }),
    })

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribe(blob)
    expect(result).toEqual({ text: 'transcribed text', source: 'whisper' })
  })

  it('returns failed source when API transcription fails', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    })

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribe(blob)
    expect(result).toEqual({ text: null, source: 'failed' })
  })

  it('returns failed source on network error', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'))

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribe(blob)
    expect(result).toEqual({ text: null, source: 'failed' })
  })

  it('returns failed source when API returns empty text', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ text: '' }),
    })

    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribe(blob)
    expect(result).toEqual({ text: null, source: 'failed' })
  })
})
