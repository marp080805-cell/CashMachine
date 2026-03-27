import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { AIAgentService } from '../ai-agents/ai-agent.service'

const messageChannelEnum = z.enum(['WHATSAPP', 'EMAIL', 'SMS', 'INSTAGRAM', 'WEBCHAT'])

const createConversationSchema = z.object({
  contactId: z.string().uuid(),
  opportunityId: z.string().uuid().optional(),
  channel: messageChannelEnum.default('WHATSAPP'),
  assignedToId: z.string().uuid().optional(),
  aiEnabled: z.boolean().default(false),
  aiAgentId: z.string().uuid().optional(),
})

const conversationIncludes = {
  contact: { select: { id: true, name: true, phone: true, email: true } },
  opportunity: { select: { id: true, title: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
}

const createMessageSchema = z.object({
  content: z.string().optional(),
  mediaUrl: z.string().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).default('OUTBOUND'),
  sentBy: z.enum(['USER', 'AUTOMATION', 'AI_AGENT']).default('USER'),
  aiSuggested: z.boolean().default(false),
  aiOriginalSuggestion: z.string().optional(),
  aiWasEdited: z.boolean().default(false),
  externalId: z.string().optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1),
  channel: messageChannelEnum.default('WHATSAPP'),
  body: z.string().min(1),
  hasButtons: z.boolean().default(false),
  buttons: z.any().optional(),
  mediaUrl: z.string().optional(),
})

export default async function conversationsRoutes(app: FastifyInstance) {
  // ─── Conversations ────────────────────────────────────────────────

  app.get('/conversations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const {
      status,
      channel,
      assignedToId,
      contactId,
      opportunityId,
      search,
      page = '1',
      limit = '50',
    } = request.query as any

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(channel && { channel }),
      ...(assignedToId && { assignedToId }),
      ...(contactId && { contactId }),
      ...(opportunityId && { opportunityId }),
      ...(search && {
        contact: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: conversationIncludes,
        orderBy: { lastMessageAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.conversation.count({ where }),
    ])

    return reply.send({ conversations, total, page: Number(page), limit: Number(limit) })
  })

  app.post('/conversations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const input = createConversationSchema.parse(request.body)

    const conversation = await prisma.conversation.create({
      data: { ...input, tenantId },
      include: conversationIncludes,
    })

    return reply.status(201).send(conversation)
  })

  app.get('/conversations/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        ...conversationIncludes,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sentByUser: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    })

    return reply.send(conversation)
  })

  app.post('/conversations/:id/messages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: conversationId } = request.params as { id: string }
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const input = createMessageSchema.parse(request.body)

    await prisma.conversation.findFirstOrThrow({ where: { id: conversationId, tenantId } })

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          ...input,
          sentByUserId: input.sentBy === 'USER' ? userId : undefined,
        },
        include: {
          sentByUser: { select: { id: true, name: true, avatarUrl: true } },
        },
      })

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      })

      return msg
    })

    return reply.status(201).send(message)
  })

  app.put('/conversations/:id/assign', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const { userId } = z.object({ userId: z.string().uuid().nullable() }).parse(request.body)

    await prisma.conversation.findFirstOrThrow({ where: { id, tenantId } })

    const conversation = await prisma.conversation.update({
      where: { id },
      data: { assignedToId: userId },
      include: conversationIncludes,
    })

    return reply.send(conversation)
  })

  app.put('/conversations/:id/close', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.conversation.findFirstOrThrow({ where: { id, tenantId } })

    const conversation = await prisma.conversation.update({
      where: { id },
      data: { status: 'CLOSED' },
      include: conversationIncludes,
    })

    return reply.send(conversation)
  })

  app.get('/conversations/:id/ai-suggest', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: conversationId } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { id: conversationId, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 20 },
        contact: { select: { id: true, name: true } },
      },
    })

    if (!conversation.aiAgentId) {
      return reply.status(400).send({ error: 'No AI agent configured for this conversation' })
    }

    const agent = await prisma.aIAgent.findFirstOrThrow({
      where: { id: conversation.aiAgentId, tenantId },
    })

    const lastMessage = conversation.messages[conversation.messages.length - 1]
    const input = lastMessage?.content ?? 'Olá'

    const result = await AIAgentService.callAgent(
      { id: agent.id, systemPrompt: agent.systemPrompt, model: agent.model, tenantId },
      { input, conversationId }
    )

    return reply.send(result)
  })

  // ─── AI Suggestions ───────────────────────────────────────────────

  app.put('/ai-suggestions/:id/action', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      action: z.enum(['APPROVED_AS_IS', 'EDITED_AND_SENT', 'REJECTED']),
      editedText: z.string().optional(),
    })
    const { action, editedText } = schema.parse(request.body)

    const suggestion = await prisma.aISuggestion.update({
      where: { id },
      data: {
        action,
        ...(editedText && { editedText }),
      },
    })

    return reply.send(suggestion)
  })

  // ─── Message Templates ────────────────────────────────────────────

  app.get('/message-templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { channel } = request.query as { channel?: string }

    const templates = await prisma.messageTemplate.findMany({
      where: {
        tenantId,
        ...(channel && { channel: channel as any }),
      },
      orderBy: { name: 'asc' },
    })

    return reply.send(templates)
  })

  app.post('/message-templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const input = createTemplateSchema.parse(request.body)

    const template = await prisma.messageTemplate.create({
      data: { ...input, tenantId },
    })

    return reply.status(201).send(template)
  })

  app.patch('/message-templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createTemplateSchema.partial().parse(request.body)

    await prisma.messageTemplate.findFirstOrThrow({ where: { id, tenantId } })

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: input,
    })

    return reply.send(template)
  })

  app.delete('/message-templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.messageTemplate.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.messageTemplate.delete({ where: { id } })

    return reply.send({ success: true })
  })
}
