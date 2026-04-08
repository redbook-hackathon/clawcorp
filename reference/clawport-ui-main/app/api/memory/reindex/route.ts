import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { requireEnv } from '@/lib/env'

export async function POST() {
  let bin: string
  try {
    bin = requireEnv('OPENCLAW_BIN')
  } catch {
    return NextResponse.json(
      { status: 'unavailable', message: 'OPENCLAW_BIN not configured', timestamp: null },
      { status: 503 }
    )
  }

  try {
    const output = execSync(`${bin} memory reindex`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    return NextResponse.json({
      status: 'success',
      message: output || 'Reindex completed',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reindex failed'
    return NextResponse.json({
      status: 'failed',
      message,
      timestamp: new Date().toISOString(),
    })
  }
}
