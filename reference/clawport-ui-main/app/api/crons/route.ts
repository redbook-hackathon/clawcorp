import { getCrons } from '@/lib/crons'
import { loadPipelines } from '@/lib/cron-pipelines.server'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const crons = await getCrons()
    const pipelines = loadPipelines()
    return NextResponse.json({ crons, pipelines })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load cron jobs')
  }
}
