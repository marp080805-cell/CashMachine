import { Queue, Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { BotExecutorService } from '../modules/salesbots/bot-executor.service'

const connection = { url: env.REDIS_URL }

export const botExecutionQueue = new Queue('bot-execution', { connection })

export function startBotExecutionWorker() {
  return new Worker(
    'bot-execution',
    async (job) => {
      const { executionId } = job.data as { executionId: string }

      const execution = await prisma.salesBotExecution.findUnique({
        where: { id: executionId },
        include: { bot: true },
      })

      if (!execution) {
        throw new Error(`SalesBotExecution not found: ${executionId}`)
      }

      if (execution.status === 'PAUSED' || execution.status === 'COMPLETED' || execution.status === 'STOPPED_BY_HUMAN') {
        return
      }

      const steps = execution.bot.steps as Record<string, unknown>[]
      const currentStepId = execution.currentStepId ?? execution.bot.entryPoint

      const step = Array.isArray(steps)
        ? steps.find((s: any) => s.id === currentStepId)
        : (steps as Record<string, unknown>)[currentStepId]

      if (!step) {
        await prisma.salesBotExecution.update({
          where: { id: executionId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        return
      }

      await BotExecutorService.executeStep(execution, step as any)
    },
    { connection }
  )
}
