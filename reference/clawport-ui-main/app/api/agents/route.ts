import { getAgents } from '@/lib/agents'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const agents = await getAgents()
    return NextResponse.json(agents)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load agents')
  }
}
