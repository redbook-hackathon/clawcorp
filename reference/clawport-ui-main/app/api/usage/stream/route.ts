import { fetchClaudeCodeUsage } from '@/lib/claude-usage'

const POLL_INTERVAL_MS = 60 * 1000 // 60 seconds
const HEARTBEAT_INTERVAL_MS = 15 * 1000
const MAX_LIFETIME_MS = 30 * 60 * 1000 // 30 minutes

export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let poll: ReturnType<typeof setInterval> | null = null
      let heartbeat: ReturnType<typeof setInterval> | null = null
      let lifetime: ReturnType<typeof setTimeout> | null = null

      function send(data: string) {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch { /* controller closed */ }
      }

      let lastGood: Awaited<ReturnType<typeof fetchClaudeCodeUsage>> = null

      async function tick() {
        try {
          const usage = await fetchClaudeCodeUsage()
          if (usage) lastGood = usage
          send(JSON.stringify({ type: 'usage', data: usage ?? lastGood }))
        } catch {
          send(JSON.stringify({ type: 'usage', data: lastGood }))
        }
      }

      // Immediate first fetch
      tick()

      // Poll every 60s
      poll = setInterval(tick, POLL_INTERVAL_MS)

      // Heartbeat to prevent proxy timeouts
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch { /* closed */ }
      }, HEARTBEAT_INTERVAL_MS)

      // Max lifetime safety valve
      lifetime = setTimeout(() => {
        cleanup()
        try { controller.close() } catch { /* already closed */ }
      }, MAX_LIFETIME_MS)

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup()
        try { controller.close() } catch { /* already closed */ }
      })

      function cleanup() {
        if (poll) { clearInterval(poll); poll = null }
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
        if (lifetime) { clearTimeout(lifetime); lifetime = null }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
