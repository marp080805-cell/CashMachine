import { Worker } from 'bullmq'
import { Prisma } from '@prisma/client'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { transcribeAudio } from '../modules/ai/transcription.service'
import { analyzeCallTranscription } from '../modules/ai/ai.service'

const connection = { url: env.REDIS_URL }

export function startTranscriptionWorker() {
  return new Worker(
    'transcriptions',
    async (job) => {
      const { transcriptionId, audioUrl, opportunityId } = job.data as {
        transcriptionId: string
        audioUrl: string
        opportunityId?: string
      }

      await prisma.callTranscription.update({
        where: { id: transcriptionId },
        data: { status: 'PROCESSING' },
      })

      const transcript = await transcribeAudio(audioUrl)

      let dealContext: string | null = null
      if (opportunityId) {
        const opportunity = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
          select: { title: true, value: true, contact: { select: { name: true } } },
        })
        if (opportunity) {
          dealContext = `Oportunidade: ${opportunity.title}, Valor: R$ ${opportunity.value ?? 'N/A'}, Contato: ${opportunity.contact?.name ?? 'N/A'}`
        }
      }

      const analysis = await analyzeCallTranscription(transcript, dealContext)

      await prisma.callTranscription.update({
        where: { id: transcriptionId },
        data: { transcript, analysis: analysis as unknown as Prisma.InputJsonValue, status: 'DONE' },
      })
    },
    {
      connection,
      concurrency: 2,
    }
  )
}
