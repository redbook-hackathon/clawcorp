import type { LiveLogLine } from '@/lib/types'

/** Parse a single SSE data payload into a LiveLogLine */
export function parseSSELine(data: string): LiveLogLine {
  try {
    const obj = JSON.parse(data)
    return {
      type: obj.type ?? 'log',
      time: obj.time ?? obj.ts ?? new Date().toISOString(),
      level: obj.level ?? 'info',
      message: obj.message ?? obj.msg ?? JSON.stringify(obj),
      raw: data,
    }
  } catch {
    return {
      type: 'log',
      time: new Date().toISOString(),
      level: 'info',
      message: data,
    }
  }
}

/**
 * Parse an SSE buffer into log lines and errors.
 * Returns { lines, errors, remainder } where remainder is the
 * incomplete trailing chunk to carry forward.
 */
export function parseSSEBuffer(buffer: string): {
  lines: LiveLogLine[]
  errors: string[]
  remainder: string
} {
  const chunks = buffer.split('\n\n')
  const remainder = chunks.pop() || ''
  const lines: LiveLogLine[] = []
  const errors: string[] = []

  for (const chunk of chunks) {
    const isError = chunk.includes('event: error')

    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)

      if (isError) {
        try {
          const errData = JSON.parse(payload)
          errors.push(errData.error || payload)
        } catch {
          errors.push(payload)
        }
      } else {
        lines.push(parseSSELine(payload))
      }
    }
  }

  return { lines, errors, remainder }
}
