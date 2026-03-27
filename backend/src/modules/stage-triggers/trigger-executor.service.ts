import { prisma } from '../../lib/prisma'
import type { StageTrigger, Opportunity } from '@prisma/client'

export class TriggerExecutorService {
  static async execute(trigger: StageTrigger, opportunity: Opportunity): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const startMs = Date.now()

    // Check active hours
    if (trigger.activeHours !== null && trigger.activeHours !== undefined) {
      const activeHours = trigger.activeHours as { start?: number; end?: number }
      if (activeHours.start !== undefined && activeHours.end !== undefined) {
        const hour = new Date().getHours()
        if (hour < activeHours.start || hour >= activeHours.end) {
          return { success: false, error: 'Outside active hours' }
        }
      }
    }

    const actionConfig = (trigger.actionConfig ?? {}) as Record<string, unknown>

    try {
      let result: unknown = null

      switch (trigger.actionType) {
        case 'CREATE_TASK': {
          const task = await prisma.task.create({
            data: {
              tenantId: trigger.tenantId,
              opportunityId: opportunity.id,
              title: (actionConfig.title as string) ?? 'Tarefa automática',
              description: actionConfig.description as string | undefined,
              type: (actionConfig.type as string ?? 'FOLLOW_UP') as any,
              priority: (actionConfig.priority as string ?? 'MEDIUM') as any,
              assignedToId: (actionConfig.assignedToId as string) ?? opportunity.assignedToId ?? trigger.tenantId,
              createdById: (actionConfig.createdById as string) ?? opportunity.assignedToId ?? trigger.tenantId,
              dueDate: actionConfig.dueDate ? new Date(actionConfig.dueDate as string) : undefined,
              isAutomated: true,
              automationId: trigger.id,
            },
          })
          result = task
          break
        }

        case 'SET_FIELD': {
          const customFieldId = actionConfig.customFieldId as string
          const entityType = (actionConfig.entityType as string) ?? 'opportunity'
          const entityId = opportunity.id
          const updatedById = (actionConfig.updatedById as string) ?? opportunity.assignedToId ?? trigger.tenantId

          await prisma.customFieldValue.upsert({
            where: { customFieldId_entityType_entityId: { customFieldId, entityType, entityId } },
            update: {
              valueText: actionConfig.valueText as string | undefined,
              valueNumber: actionConfig.valueNumber !== undefined ? Number(actionConfig.valueNumber) : undefined,
              valueDate: actionConfig.valueDate ? new Date(actionConfig.valueDate as string) : undefined,
              valueJson: actionConfig.valueJson as object | undefined,
              updatedById,
            },
            create: {
              customFieldId,
              entityType,
              entityId,
              valueText: actionConfig.valueText as string | undefined,
              valueNumber: actionConfig.valueNumber !== undefined ? Number(actionConfig.valueNumber) : undefined,
              valueDate: actionConfig.valueDate ? new Date(actionConfig.valueDate as string) : undefined,
              valueJson: actionConfig.valueJson as object | undefined,
              updatedById,
            },
          })
          result = { customFieldId, entityId }
          break
        }

        case 'ADD_TAG': {
          const tagId = actionConfig.tagId as string
          const assignedById = (actionConfig.assignedById as string) ?? opportunity.assignedToId ?? trigger.tenantId

          await prisma.tagAssignment.create({
            data: {
              tagId,
              entityType: 'opportunity',
              entityId: opportunity.id,
              assignedById,
              opportunityId: opportunity.id,
            },
          })
          result = { tagId, opportunityId: opportunity.id }
          break
        }

        case 'REMOVE_TAG': {
          const tagId = actionConfig.tagId as string
          await prisma.tagAssignment.deleteMany({
            where: { tagId, opportunityId: opportunity.id },
          })
          result = { tagId, opportunityId: opportunity.id }
          break
        }

        case 'CHANGE_STAGE': {
          const stageId = actionConfig.stageId as string
          const updated = await prisma.opportunity.update({
            where: { id: opportunity.id },
            data: { stageId },
          })
          result = { stageId, opportunityId: updated.id }
          break
        }

        case 'CHANGE_RESPONSIBLE': {
          const assignedToId = actionConfig.assignedToId as string
          const updated = await prisma.opportunity.update({
            where: { id: opportunity.id },
            data: { assignedToId },
          })
          result = { assignedToId, opportunityId: updated.id }
          break
        }

        case 'SEND_MESSAGE': {
          console.log('[TriggerExecutor] send_message não implementado — trigger:', trigger.id, 'opportunity:', opportunity.id)
          result = { placeholder: true }
          break
        }

        case 'NOTIFY_USER': {
          const userId = (actionConfig.userId as string) ?? opportunity.assignedToId
          if (userId) {
            await prisma.notification.create({
              data: {
                tenantId: trigger.tenantId,
                userId,
                type: 'SYSTEM',
                title: (actionConfig.title as string) ?? `Trigger: ${trigger.name}`,
                body: (actionConfig.body as string) ?? `Trigger "${trigger.name}" executado na oportunidade ${opportunity.title}`,
                link: actionConfig.link as string | undefined,
              },
            })
          }
          result = { userId }
          break
        }

        case 'WEBHOOK': {
          const url = actionConfig.url as string
          if (url) {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                triggerId: trigger.id,
                triggerName: trigger.name,
                opportunityId: opportunity.id,
                opportunityTitle: opportunity.title,
                tenantId: trigger.tenantId,
                timestamp: new Date().toISOString(),
                ...(actionConfig.extraPayload as object ?? {}),
              }),
            })
            result = { status: response.status, url }
          }
          break
        }

        case 'SALESBOT': {
          const { botExecutionQueue } = await import('../../queues/bot-execution.queue')
          const botId = actionConfig.botId as string
          if (botId) {
            const execution = await prisma.salesBotExecution.create({
              data: {
                botId,
                opportunityId: opportunity.id,
                contactId: opportunity.contactId!,
                status: 'RUNNING',
                currentStepId: actionConfig.entryPoint as string | undefined,
              },
            })
            await botExecutionQueue.add('execute-step', { executionId: execution.id })
            result = { executionId: execution.id }
          }
          break
        }

        default: {
          console.log('[TriggerExecutor] actionType não tratado:', trigger.actionType)
          result = null
          break
        }
      }

      // Update execution count
      await prisma.stageTrigger.update({
        where: { id: trigger.id },
        data: { executionCount: { increment: 1 }, lastExecutedAt: new Date() },
      })

      // Create log
      await prisma.stageTriggerLog.create({
        data: {
          triggerId: trigger.id,
          opportunityId: opportunity.id,
          status: 'SUCCESS',
          executedAt: new Date(),
          actionResult: result as object | undefined,
          durationMs: Date.now() - startMs,
        },
      })

      return { success: true, result }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)

      await prisma.stageTriggerLog.create({
        data: {
          triggerId: trigger.id,
          opportunityId: opportunity.id,
          status: 'FAILED',
          executedAt: new Date(),
          errorMessage,
          durationMs: Date.now() - startMs,
        },
      })

      return { success: false, error: errorMessage }
    }
  }
}
