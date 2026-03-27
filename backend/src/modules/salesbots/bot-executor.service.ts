import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { SalesBotExecution, SalesBot } from '@prisma/client'

type BotStep = {
  id: string
  type: string
  config?: Record<string, unknown>
  nextStepId?: string
  branches?: { condition: unknown; nextStepId: string }[]
}

type ExecutionWithBot = SalesBotExecution & { bot: SalesBot }

export class BotExecutorService {
  static async executeStep(execution: ExecutionWithBot, step: BotStep): Promise<void> {
    const { botExecutionQueue } = await import('../../queues/bot-execution.queue')
    const config = step.config ?? {}

    switch (step.type) {
      case 'send_message': {
        console.log('[BotExecutor] enviaria mensagem para oportunidade:', execution.opportunityId, '| step:', step.id, '| config:', config)
        await BotExecutorService.advanceStep(execution, step.nextStepId)
        break
      }

      case 'wait': {
        const delayMs = (config.delayMs as number) ?? (config.delaySeconds as number ?? 60) * 1000
        if (delayMs > 0) {
          await botExecutionQueue.add(
            'execute-step',
            { executionId: execution.id },
            { delay: delayMs }
          )
        } else {
          await BotExecutorService.advanceStep(execution, step.nextStepId)
        }
        break
      }

      case 'wait_for_response': {
        await prisma.salesBotExecution.update({
          where: { id: execution.id },
          data: {
            status: 'PAUSED',
            pausedReason: 'Aguardando resposta do contato',
            currentStepId: step.id,
          },
        })
        break
      }

      case 'condition': {
        const branches = step.branches ?? []
        let nextStepId = step.nextStepId

        for (const branch of branches) {
          const matched = await BotExecutorService.evaluateCondition(branch.condition, execution)
          if (matched) {
            nextStepId = branch.nextStepId
            break
          }
        }

        await BotExecutorService.advanceStep(execution, nextStepId)
        break
      }

      case 'set_field': {
        const customFieldId = config.customFieldId as string
        const entityType = (config.entityType as string) ?? 'opportunity'
        const entityId = execution.opportunityId
        const opportunity = await prisma.opportunity.findUnique({ where: { id: entityId } })
        const updatedById = (config.updatedById as string) ?? opportunity?.assignedToId ?? ''

        if (customFieldId && updatedById) {
          await prisma.customFieldValue.upsert({
            where: { customFieldId_entityType_entityId: { customFieldId, entityType, entityId } },
            update: {
              valueText: config.valueText as string | undefined,
              valueNumber: config.valueNumber !== undefined ? Number(config.valueNumber) : undefined,
              valueDate: config.valueDate ? new Date(config.valueDate as string) : undefined,
              valueJson: config.valueJson as Prisma.InputJsonValue | undefined,
              updatedById,
            },
            create: {
              customFieldId,
              entityType,
              entityId,
              valueText: config.valueText as string | undefined,
              valueNumber: config.valueNumber !== undefined ? Number(config.valueNumber) : undefined,
              valueDate: config.valueDate ? new Date(config.valueDate as string) : undefined,
              valueJson: config.valueJson as Prisma.InputJsonValue | undefined,
              updatedById,
            },
          })
        }
        await BotExecutorService.advanceStep(execution, step.nextStepId)
        break
      }

      case 'add_tag': {
        const tagId = config.tagId as string
        const opportunity = await prisma.opportunity.findUnique({ where: { id: execution.opportunityId } })
        const assignedById = (config.assignedById as string) ?? opportunity?.assignedToId ?? ''

        if (tagId && assignedById) {
          await prisma.tagAssignment.create({
            data: {
              tagId,
              entityType: 'opportunity',
              entityId: execution.opportunityId,
              assignedById,
              opportunityId: execution.opportunityId,
            },
          })
        }
        await BotExecutorService.advanceStep(execution, step.nextStepId)
        break
      }

      case 'change_stage': {
        const stageId = config.stageId as string
        if (stageId) {
          await prisma.opportunity.update({
            where: { id: execution.opportunityId },
            data: { stageId },
          })
        }
        await BotExecutorService.advanceStep(execution, step.nextStepId)
        break
      }

      case 'create_task': {
        const opportunity = await prisma.opportunity.findUnique({ where: { id: execution.opportunityId } })
        if (opportunity) {
          await prisma.task.create({
            data: {
              tenantId: execution.bot.tenantId,
              opportunityId: execution.opportunityId,
              title: (config.title as string) ?? 'Tarefa do bot',
              description: config.description as string | undefined,
              type: (config.type as string ?? 'FOLLOW_UP') as any,
              priority: (config.priority as string ?? 'MEDIUM') as any,
              assignedToId: (config.assignedToId as string) ?? opportunity.assignedToId,
              createdById: (config.createdById as string) ?? opportunity.assignedToId,
              isAutomated: true,
            },
          })
        }
        await BotExecutorService.advanceStep(execution, step.nextStepId)
        break
      }

      case 'webhook': {
        const url = config.url as string
        if (url) {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              executionId: execution.id,
              opportunityId: execution.opportunityId,
              stepId: step.id,
              timestamp: new Date().toISOString(),
              ...(config.extraPayload as Record<string, unknown> ?? {}),
            }),
          })
        }
        await BotExecutorService.advanceStep(execution, step.nextStepId)
        break
      }

      case 'stop': {
        await prisma.salesBotExecution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            currentStepId: step.id,
          },
        })
        break
      }

      default: {
        console.log('[BotExecutor] step type não tratado:', step.type, '| avançando para próximo step')
        await BotExecutorService.advanceStep(execution, step.nextStepId)
        break
      }
    }
  }

  private static async advanceStep(execution: ExecutionWithBot, nextStepId?: string): Promise<void> {
    if (!nextStepId) {
      await prisma.salesBotExecution.update({
        where: { id: execution.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      return
    }

    await prisma.salesBotExecution.update({
      where: { id: execution.id },
      data: { currentStepId: nextStepId },
    })

    const { botExecutionQueue } = await import('../../queues/bot-execution.queue')
    await botExecutionQueue.add('execute-step', { executionId: execution.id })
  }

  private static async evaluateCondition(condition: unknown, execution: ExecutionWithBot): Promise<boolean> {
    if (!condition || typeof condition !== 'object') return false
    const cond = condition as Record<string, unknown>
    const field = cond.field as string
    const operator = cond.operator as string
    const value = cond.value

    try {
      const opportunity = await prisma.opportunity.findUnique({ where: { id: execution.opportunityId } })
      if (!opportunity) return false

      const fieldValue = (opportunity as Record<string, unknown>)[field]

      switch (operator) {
        case 'eq': return fieldValue === value
        case 'neq': return fieldValue !== value
        case 'gt': return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value
        case 'lt': return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value
        case 'contains': return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value)
        default: return false
      }
    } catch {
      return false
    }
  }
}
