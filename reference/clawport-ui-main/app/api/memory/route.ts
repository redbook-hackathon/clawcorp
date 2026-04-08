import { getMemoryFiles, getMemoryConfig, getMemoryStatus, computeMemoryStats } from '@/lib/memory'
import { computeMemoryHealth } from '@/lib/memory-health'
import { writeMemoryFile, PathValidationError } from '@/lib/memory-write'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const files = await getMemoryFiles()
    const config = getMemoryConfig()
    const status = getMemoryStatus()
    const stats = computeMemoryStats(files)
    const health = computeMemoryHealth(files, config, status, stats)
    return NextResponse.json({ files, config, status, stats, health })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load memory files')
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { relativePath, content, expectedLastModified } = body

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content must be a string' }, { status: 400 })
    }

    const result = writeMemoryFile(relativePath, content, expectedLastModified)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof PathValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    if (code === 'E2BIG') {
      return NextResponse.json({ error: (err as Error).message }, { status: 413 })
    }
    if (code === 'ECONFLICT') {
      return NextResponse.json(
        { error: 'File was modified by another process. Refresh or overwrite.' },
        { status: 409 }
      )
    }
    return apiErrorResponse(err, 'Failed to save memory file')
  }
}
