import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { Prisma, UserRole } from '@prisma/client'

const createDealSchema = z.object({
  title: z.string().min(1),
  value: z.number().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedClose: z.string().datetime().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
  funnelId: z.string().uuid(),
  stageId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  assignedToId: z.string().uuid(),
})

const listDealsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  funnelId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'WON', 'LOST', 'FROZEN']).optional(),
  search: z.string().optional(),
})

// Used in mutations (create/update) — Prisma does not support orderBy/take in select for mutations
const dealSelectWrite = {
  id: true,
  title: true,
  value: true,
  probability: true,
  expectedClose: true,
  status: true,
  isFrozen: true,
  notes: true,
  funnelId: true,
  stageId: true,
  createdAt: true,
  updatedAt: true,
  lead: { select: { id: true, name: true, phone: true } },
  company: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  stage: { select: { id: true, name: true, color: true } },
  funnel: { select: { id: true, name: true } },
}

// Used in reads (findMany/findUnique) — supports nested orderBy/take
const dealSelect = {
  ...dealSelectWrite,
  lead: {
    select: {
      id: true,
      name: true,
      phone: true,
      conversations: {
        select: { id: true, lastMessage: true, lastMessageAt: true, unreadCount: true },
        orderBy: [{ lastMessageAt: 'desc' as const }],
        take: 1,
      },
    },
  },
}

export default async function dealsRoutes(app: FastifyInstance) {
  app.get(
    '/deals',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = listDealsSchema.parse(request.query)
      const user = request.user as { id: string; role: UserRole }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)

      const where: Prisma.DealWhereInput = {}
      if (!isAdmin) where['assignedToId'] = user.id
      if (query.funnelId) where['funnelId'] = query.funnelId
      if (query.stageId) where['stageId'] = query.stageId
      if (query.assignedToId) where['assignedToId'] = query.assignedToId
      if (query.status) where['status'] = query.status
      if (query.search) where['title'] = { contains: query.search, mode: 'insensitive' }

      const skip = (query.page - 1) * query.limit
      const [deals, total] = await Promise.all([
        prisma.deal.findMany({ where, skip, take: query.limit, select: dealSelect, orderBy: { updatedAt: 'desc' } }),
        prisma.deal.count({ where }),
      ])

      return reply.send({ deals, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } })
    }
  )

  app.get(
    '/deals/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const deal = await prisma.deal.findUniqueOrThrow({
        where: { id },
        include: {
          lead: true,
          company: true,
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
          stage: true,
          funnel: { select: { id: true, name: true } },
          activities: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: 'desc' },
          },
          tasks: {
            include: { assignedTo: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { dueDate: 'asc' },
          },
        },
      })
      return reply.send(deal)
    }
  )

  app.post(
    '/deals',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = createDealSchema.parse(request.body)
      const user = request.user as { id: string }

      const deal = await prisma.$transaction(async (tx) => {
        const { customFields, ...dealData } = input
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newDeal = await tx.deal.create({
          data: {
            ...dealData,
            ...(customFields !== undefined ? { customFields } : {}),
          } as any,
          select: dealSelectWrite,
        })
        await tx.activity.create({
          data: {
            type: 'DEAL_CREATED',
            description: `Deal "${input.title}" criado`,
            dealId: newDeal.id,
            leadId: input.leadId,
            userId: user.id,
          },
        })
        return newDeal
      })

      return reply.status(201).send(deal)
    }
  )

  app.patch(
    '/deals/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const input = createDealSchema.partial().parse(request.body)
      const { customFields, ...dealData } = input
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deal = await prisma.deal.update({
        where: { id },
        data: { ...dealData, ...(customFields !== undefined ? { customFields } : {}) } as any,
        select: dealSelectWrite,
      })
      return reply.send(deal)
    }
  )

  app.patch(
    '/deals/:id/move',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { stageId } = z.object({ stageId: z.string().uuid() }).parse(request.body)
      const user = request.user as { id: string }

      const deal = await prisma.$transaction(async (tx) => {
        const current = await tx.deal.findUniqueOrThrow({ where: { id }, include: { stage: true } })
        const newStage = await tx.funnelStage.findUniqueOrThrow({ where: { id: stageId } })

        const updated = await tx.deal.update({ where: { id }, data: { stageId }, select: dealSelectWrite })

        await tx.activity.create({
          data: {
            type: 'DEAL_MOVED',
            description: `Deal movido de "${current.stage.name}" para "${newStage.name}"`,
            dealId: id,
            leadId: current.leadId ?? undefined,
            userId: user.id,
            metadata: { fromStage: current.stage.name, toStage: newStage.name } as Prisma.InputJsonValue,
          },
        })

        return updated
      })

      return reply.send(deal)
    }
  )

  app.patch(
    '/deals/:id/freeze',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const current = await prisma.deal.findUniqueOrThrow({ where: { id }, select: { isFrozen: true } })
      const deal = await prisma.deal.update({
        where: { id },
        data: { isFrozen: !current.isFrozen, status: !current.isFrozen ? 'FROZEN' : 'OPEN' },
        select: dealSelectWrite,
      })
      return reply.send(deal)
    }
  )

  app.post(
    '/deals/:id/won',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = request.user as { id: string }

      const deal = await prisma.$transaction(async (tx) => {
        const updated = await tx.deal.update({
          where: { id },
          data: { status: 'WON' },
          select: dealSelectWrite,
        })
        await tx.activity.create({
          data: {
            type: 'DEAL_WON',
            description: `Deal "${updated.title}" marcado como GANHO`,
            dealId: id,
            userId: user.id,
          },
        })
        return updated
      })

      return reply.send(deal)
    }
  )

  app.post(
    '/deals/:id/lost',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { lossReason } = z.object({ lossReason: z.string().min(1) }).parse(request.body)
      const user = request.user as { id: string }

      const deal = await prisma.$transaction(async (tx) => {
        const updated = await tx.deal.update({
          where: { id },
          data: { status: 'LOST', lossReason },
          select: dealSelectWrite,
        })
        await tx.activity.create({
          data: {
            type: 'DEAL_LOST',
            description: `Deal "${updated.title}" marcado como PERDIDO. Motivo: ${lossReason}`,
            dealId: id,
            userId: user.id,
            metadata: { lossReason } as Prisma.InputJsonValue,
          },
        })
        return updated
      })

      return reply.send(deal)
    }
  )

  app.delete(
    '/deals/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.deal.delete({ where: { id } })
      return reply.status(204).send()
    }
  )
}
