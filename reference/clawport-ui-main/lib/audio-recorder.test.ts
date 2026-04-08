// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { formatDuration, estimateStorageSize } from './audio-recorder'

// --- formatDuration ---

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats seconds under a minute', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(12)).toBe('0:12')
    expect(formatDuration(59)).toBe('0:59')
  })

  it('formats exact minutes', () => {
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(120)).toBe('2:00')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(130)).toBe('2:10')
  })

  it('pads single-digit seconds with leading zero', () => {
    expect(formatDuration(61)).toBe('1:01')
    expect(formatDuration(9)).toBe('0:09')
  })

  it('handles fractional seconds by flooring', () => {
    expect(formatDuration(5.7)).toBe('0:05')
    expect(formatDuration(65.9)).toBe('1:05')
  })

  it('handles large values', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })
})

// --- estimateStorageSize ---

describe('estimateStorageSize', () => {
  it('estimates size from base64 data URL', () => {
    // "data:audio/webm;base64," prefix = 23 chars
    // base64 payload of 100 chars ≈ 75 bytes
    const prefix = 'data:audio/webm;base64,'
    const payload = 'A'.repeat(100)
    const dataUrl = prefix + payload
    const size = estimateStorageSize(dataUrl)
    expect(size).toBe(75) // ceil(100 * 0.75)
  })

  it('returns full length when no comma found', () => {
    const size = estimateStorageSize('no-comma-here')
    expect(size).toBe(13)
  })

  it('handles empty payload after comma', () => {
    const size = estimateStorageSize('data:audio/webm;base64,')
    expect(size).toBe(0)
  })

  it('handles realistic-sized data URL', () => {
    const prefix = 'data:audio/webm;base64,'
    const payload = 'A'.repeat(10000) // ~7500 bytes of audio
    const size = estimateStorageSize(prefix + payload)
    expect(size).toBe(7500)
  })
})
