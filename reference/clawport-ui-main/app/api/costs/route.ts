import { getCronRuns } from '@/lib/cron-runs'
import { computeCostSummary } from '@/lib/costs'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const runs = getCronRuns()
    const summary = computeCostSummary(runs)
    return NextResponse.json(summary)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to compute costs')
  }
}
