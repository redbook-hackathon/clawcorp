const WAVEFORM_SAMPLES = 50

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function estimateStorageSize(dataUrl: string): number {
  // base64 is ~4/3 of binary size; data URL has a prefix like "data:audio/webm;base64,"
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return dataUrl.length
  return Math.ceil((dataUrl.length - commaIndex - 1) * 0.75)
}

export interface AudioRecordingResult {
  audioBlob: Blob
  dataUrl: string
  duration: number
  waveform: number[]
}

export interface AudioRecorderHandle {
  start: () => Promise<void>
  stop: () => Promise<AudioRecordingResult>
  cancel: () => void
  getElapsed: () => number
  isRecording: () => boolean
}

export function createAudioRecorder(): AudioRecorderHandle {
  let mediaRecorder: MediaRecorder | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let startTime = 0
  let recording = false
  let cancelled = false
  let rafId = 0

  // Raw amplitude samples collected during recording, downsampled to WAVEFORM_SAMPLES on stop
  const rawAmplitudes: number[] = []

  function collectAmplitude() {
    if (!analyser || !recording) return
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    // RMS amplitude 0-1
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    rawAmplitudes.push(Math.sqrt(sum / data.length))
    rafId = requestAnimationFrame(collectAmplitude)
  }

  function downsample(raw: number[], targetLen: number): number[] {
    if (raw.length === 0) return Array(targetLen).fill(0.1)
    const result: number[] = []
    const step = raw.length / targetLen
    for (let i = 0; i < targetLen; i++) {
      const start = Math.floor(i * step)
      const end = Math.floor((i + 1) * step)
      let max = 0
      for (let j = start; j < end && j < raw.length; j++) {
        if (raw[j] > max) max = raw[j]
      }
      // Clamp to 0.05-1 range so bars are always visible
      result.push(Math.max(0.05, Math.min(1, max)))
    }
    return result
  }

  return {
    async start() {
      cancelled = false
      chunks = []
      rawAmplitudes.length = 0

      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.start(100) // 100ms timeslice for frequent chunks
      startTime = Date.now()
      recording = true
      collectAmplitude()
    },

    async stop(): Promise<AudioRecordingResult> {
      recording = false
      cancelAnimationFrame(rafId)

      const duration = (Date.now() - startTime) / 1000

      return new Promise((resolve, reject) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          reject(new Error('Not recording'))
          return
        }

        mediaRecorder.onstop = async () => {
          // Cleanup
          stream?.getTracks().forEach(t => t.stop())
          audioContext?.close().catch(() => {})

          const blob = new Blob(chunks, { type: mediaRecorder!.mimeType || 'audio/webm' })
          const dataUrl = await blobToDataUrl(blob)
          const waveform = downsample(rawAmplitudes, WAVEFORM_SAMPLES)

          resolve({ audioBlob: blob, dataUrl, duration, waveform })
        }

        mediaRecorder.stop()
      })
    },

    cancel() {
      cancelled = true
      recording = false
      cancelAnimationFrame(rafId)
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
      stream?.getTracks().forEach(t => t.stop())
      audioContext?.close().catch(() => {})
      chunks = []
      rawAmplitudes.length = 0
    },

    getElapsed() {
      if (!recording) return 0
      return (Date.now() - startTime) / 1000
    },

    isRecording() {
      return recording && !cancelled
    },
  }
}
