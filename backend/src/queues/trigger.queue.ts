import { Queue, Worker } from 'bullmq'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { TriggerExecutorService } from '../modules/stage-triggers/trigger-executor.service'

const connection = { url: env.REDIS_URL }

export const stageTriggerQueue = new Queue('stage-triggers', { connection })

export function startStageTriggerWorker() {
  return new Worker(
    'stage-triggers',
    async (job) => {
      const { triggerId, opportunityId } = job.data as {
        triggerId: string
        opportunityId: string
      }

      const trigger = await prisma.stageTrigger.findUnique({ where: { id: triggerId } })
      if (!trigger) {
        throw new Error(`Trigger not found: ${triggerId}`)
      }

      if (!trigger.isActive) {
        await prisma.stageTriggerLog.create({
          data: {
            triggerId,
            opportunityId,
            status: 'SKIPPED',
            skippedReason: 'Trigger is inactive',
            executedAt: new Date(),
          },
        })
        return
      }

      const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } })
      if (!opportunity) {
        throw new Error(`Opportunity not found: ${opportunityId}`)
      }

      const result = await TriggerExecutorService.execute(trigger, opportunity)

      if (!result.success) {
        throw new Error(result.error ?? 'Trigger execution failed')
      }
    },
    { connection }
  )
}
