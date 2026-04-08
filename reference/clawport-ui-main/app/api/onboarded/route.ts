import { NextRequest } from 'next/server'
import { isOnboarded, setOnboarded } from '@/lib/conversation-store'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET() {
  try {
    return Response.json({ onboarded: isOnboarded() })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to check onboarded status')
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (typeof body.onboarded !== 'boolean') {
      return Response.json({ error: 'onboarded boolean required' }, { status: 400 })
    }
    setOnboarded(body.onboarded)
    return Response.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update onboarded status')
  }
}
