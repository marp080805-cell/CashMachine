import { Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { transcribeAudio } from '../modules/ai/transcription.service'
import { analyzeCallTranscription } from '../modules/ai/ai.service'

const connection = { url: env.REDIS_URL }

export function startTranscriptionWorker() {
  return new Worker(
    'transcriptions',
    async (job) => {
      const { transcriptionId, audioUrl, dealId } = job.data as {
        transcriptionId: string
        audioUrl: string
        dealId?: string
      }

      await prisma.callTranscription.update({
        where: { id: transcriptionId },
        data: { status: 'PROCESSING' },
      })

      const transcript = await transcribeAudio(audioUrl)

      let dealContext: string | null = null
      if (dealId) {
        const deal = await prisma.deal.findUnique({
          where: { id: dealId },
          select: { title: true, value: true, lead: { select: { name: true } } },
        })
        if (deal) {
          dealContext = `Deal: ${deal.title}, Valor: R$ ${deal.value ?? 'N/A'}, Lead: ${deal.lead?.name ?? 'N/A'}`
        }
      }

      const analysis = await analyzeCallTranscription(transcript, dealContext)

      await prisma.callTranscription.update({
        where: { id: transcriptionId },
        data: { transcript, analysis, status: 'DONE' },
      })
    },
    {
      connection,
      concurrency: 2,
    }
  )
}
