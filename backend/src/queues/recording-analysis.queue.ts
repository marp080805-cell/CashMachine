import { Queue, Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'

const connection = { url: env.REDIS_URL }

export const recordingAnalysisQueue = new Queue('recording-analysis', { connection })

const ANALYSIS_PROMPT = `Você é um analista de vendas especialista. Analise a transcrição da ligação/reunião abaixo e forneça uma análise estruturada em JSON com o seguinte formato exato:

{
  "overall_score": <número de 0 a 10>,
  "strengths": [<lista de pontos fortes como strings>],
  "improvements": [<lista de pontos de melhoria como strings>],
  "objections": [<lista de objeções levantadas pelo cliente como strings>],
  "action_items": [
    { "text": <descrição da próxima ação>}
  ]
}

Responda APENAS com o JSON, sem texto adicional.

Transcrição:
`

export function startRecordingAnalysisWorker() {
  return new Worker(
    'recording-analysis',
    async (job) => {
      const { recordingId } = job.data as { recordingId: string }

      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              tenantId: true,
              assignedToId: true,
            },
          },
        },
      })

      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`)
      }

      if (!recording.transcriptionText) {
        throw new Error(`Recording ${recordingId} has no transcription text`)
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: recording.tenantId },
        select: { openaiApiKey: true, openaiModel: true },
      })

      let aiAnalysis: {
        overall_score: number
        strengths: string[]
        improvements: string[]
        objections: string[]
        action_items: { text: string }[]
      } | null = null

      const apiKey = tenant?.openaiApiKey ?? env.OPENAI_API_KEY

      if (apiKey) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
          const OpenAI = require('openai') as any
          const openai = new OpenAI({ apiKey })

          const model = tenant?.openaiModel ?? 'gpt-4o'

          const response = await openai.chat.completions.create({
            model,
            messages: [
              {
                role: 'user',
                content: ANALYSIS_PROMPT + recording.transcriptionText,
              },
            ],
            temperature: 0.2,
            max_tokens: 1500,
          })

          const rawContent = response.choices[0]?.message?.content ?? '{}'
          aiAnalysis = JSON.parse(rawContent)
        } catch (err) {
          console.error('[recording-analysis] OpenAI error:', err)
          // proceed without AI analysis, just mark as READY
        }
      }

      // Update recording with analysis
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          aiAnalysis: aiAnalysis as any,
          analyzedAt: new Date(),
          uploadStatus: 'READY',
          autoTasksCreated: aiAnalysis?.action_items ? true : false,
        },
      })

      // Create tasks for each action_item
      if (aiAnalysis?.action_items && recording.opportunity) {
        const { id: opportunityId, tenantId, assignedToId } = recording.opportunity

        for (const item of aiAnalysis.action_items) {
          if (!item.text) continue
          await prisma.task.create({
            data: {
              tenantId,
              opportunityId,
              assignedToId,
              createdById: recording.closerId,
              title: item.text,
              type: 'SEND_RECORDING_ACTION',
              priority: 'MEDIUM',
              status: 'PENDING',
              isAutomated: true,
              description: `Ação gerada automaticamente pela análise de IA da gravação "${recording.title}"`,
            },
          })
        }
      }
    },
    {
      connection,
      concurrency: 2,
    }
  )
}
