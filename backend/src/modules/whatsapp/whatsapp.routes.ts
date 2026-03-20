import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import {
  createInstance,
  getQRCode,
  sendTextMessage,
  deleteInstance,
} from './evolution.client'
import { handleIncomingWebhook } from './whatsapp.service'
import type { UserRole } from '@prisma/client'

export default async function whatsappRoutes(app: FastifyInstance) {
  app.get(
    '/whatsapp/numbers',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as { id: string; role: UserRole }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)

      const numbers = await prisma.whatsappNumber.findMany({
        where: isAdmin ? {} : { userId: user.id },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      })

      return reply.send({ numbers })
    }
  )

  app.post(
    '/whatsapp/numbers',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = z.object({
        userId: z.string().uuid().optional(),
        phone: z.string().optional(),
      }).parse(request.body ?? {})

      const user = request.user as { id: string }
      const ownerId = userId ?? user.id

      const instanceName = `cashmachine_${ownerId.replace(/-/g, '').slice(0, 12)}_${Date.now()}`

      await createInstance(instanceName)
      const { qrcode } = await getQRCode(instanceName)

      const number = await prisma.whatsappNumber.create({
        data: {
          phone: `pending_${instanceName}`,
          instanceName,
          userId: ownerId,
          status: 'CONNECTING',
        },
      })

      return reply.status(201).send({ ...number, qrcode })
    }
  )

  app.get(
    '/whatsapp/numbers/:id/qrcode',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const number = await prisma.whatsappNumber.findUniqueOrThrow({ where: { id } })
      const { qrcode } = await getQRCode(number.instanceName)
      return reply.send({ qrcode })
    }
  )

  app.delete(
    '/whatsapp/numbers/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const number = await prisma.whatsappNumber.findUniqueOrThrow({ where: { id } })

      try {
        await deleteInstance(number.instanceName)
      } catch {
        // Instance may not exist on evolution API
      }

      await prisma.whatsappNumber.delete({ where: { id } })
      return reply.status(204).send()
    }
  )

  app.get(
    '/whatsapp/conversations',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { page, limit, archived, unreadOnly, search } = z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(20),
        archived: z.coerce.boolean().default(false),
        unreadOnly: z.coerce.boolean().default(false),
        search: z.string().optional(),
      }).parse(request.query)

      const user = request.user as { id: string; role: UserRole }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)

      const userNumbers = await prisma.whatsappNumber.findMany({
        where: isAdmin ? {} : { userId: user.id },
        select: { id: true },
      })
      const numberIds = userNumbers.map((n) => n.id)

      const where: Record<string, unknown> = {
        numberId: { in: numberIds },
        isArchived: archived,
      }

      if (unreadOnly) where['unreadCount'] = { gt: 0 }
      if (search) {
        where['OR'] = [
          { remoteName: { contains: search, mode: 'insensitive' } },
          { remotePhone: { contains: search } },
        ]
      }

      const skip = (page - 1) * limit
      const [conversations, total] = await Promise.all([
        prisma.whatsappConversation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { lastMessageAt: 'desc' },
          include: {
            number: { select: { id: true, phone: true, status: true } },
            lead: { select: { id: true, name: true, status: true } },
          },
        }),
        prisma.whatsappConversation.count({ where }),
      ])

      return reply.send({ conversations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    }
  )

  app.get(
    '/whatsapp/conversations/:id/messages',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { cursor, limit } = z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().default(50),
      }).parse(request.query)

      const messages = await prisma.whatsappMessage.findMany({
        where: {
          conversationId: id,
          ...(cursor ? { timestamp: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      })

      const nextCursor = messages.length === limit
        ? messages[messages.length - 1]?.timestamp.toISOString()
        : null

      return reply.send({ messages: messages.reverse(), nextCursor })
    }
  )

  app.post(
    '/whatsapp/conversations/:id/send',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { text } = z.object({ text: z.string().min(1) }).parse(request.body)

      const conversation = await prisma.whatsappConversation.findUniqueOrThrow({
        where: { id },
        include: { number: true },
      })

      const remoteId = await sendTextMessage(
        conversation.number.instanceName,
        conversation.remoteJid,
        text
      )

      const message = await prisma.whatsappMessage.create({
        data: {
          remoteId,
          conversationId: id,
          content: text,
          type: 'TEXT',
          fromMe: true,
          status: 'SENT',
          timestamp: new Date(),
        },
      })

      await prisma.whatsappConversation.update({
        where: { id },
        data: { lastMessage: text, lastMessageAt: new Date() },
      })

      app.io.to(`conversation:${id}`).emit('message:new', { conversationId: id, message })

      return reply.status(201).send(message)
    }
  )

  app.patch(
    '/whatsapp/conversations/:id/read',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await prisma.whatsappConversation.update({ where: { id }, data: { unreadCount: 0 } })
      return reply.status(204).send()
    }
  )

  app.post(
    '/whatsapp/conversations/:id/link-lead',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { leadId } = z.object({ leadId: z.string().uuid() }).parse(request.body)

      const conversation = await prisma.whatsappConversation.update({
        where: { id },
        data: { leadId },
        include: { lead: { select: { id: true, name: true } } },
      })

      return reply.send(conversation)
    }
  )

  app.post(
    '/whatsapp/webhook/:instanceName',
    async (request, reply) => {
      const { instanceName } = request.params as { instanceName: string }
      const payload = request.body as EvolutionWebhookPayload

      await handleIncomingWebhook(app, instanceName, payload)

      return reply.status(200).send({ ok: true })
    }
  )
}
