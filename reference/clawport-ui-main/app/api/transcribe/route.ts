export const runtime = 'nodejs'

import OpenAI from 'openai'
import { gatewayBaseUrl } from '@/lib/env'

const openai = new OpenAI({
  baseURL: gatewayBaseUrl(),
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
})

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const audioFile = formData.get('audio')
  if (!audioFile || !(audioFile instanceof File)) {
    return Response.json({ error: 'Missing audio file' }, { status: 400 })
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
    })

    return Response.json({ text: transcription.text })
  } catch (err) {
    console.error('Transcription error:', err)
    return Response.json(
      { error: 'Transcription failed. Check OpenClaw gateway.' },
      { status: 500 }
    )
  }
}
