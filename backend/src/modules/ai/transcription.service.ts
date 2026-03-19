import OpenAI from 'openai'
import { env } from '../../config/env'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl)
  const buffer = await response.arrayBuffer()

  const tempPath = path.join('/tmp', `audio_${Date.now()}.mp3`)
  fs.writeFileSync(tempPath, Buffer.from(buffer))

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'pt',
    })

    return transcription.text
  } finally {
    fs.unlinkSync(tempPath)
  }
}
