import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import {
  createInstance,
  getQRCode,
  sendTextMessage,
  deleteInstance,
  getConnectionState,
  setWebhook,
} from './evolution.client'
import { handleIncomingWebhook } from './whatsapp.service'
import type { UserRole } from '@prisma/client'
import type { EvolutionWebhookPayload } from './evolution.client'
import { env } from '../../config/env'

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

  // Connect via API credentials (no QR code needed)
  app.post(
    '/whatsapp/numbers/connect',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { baseUrl, instanceName, apiKey, phone } = z.object({
        baseUrl: z.string().url(),
        instanceName: z.string().min(1),
        apiKey: z.string().min(1),
        phone: z.string().min(1),
        userId: z.string().uuid().optional(),
      }).parse(request.body)

      const user = request.user as { id: string }

      // Check if instance already exists
      const existing = await prisma.whatsappNumber.findUnique({ where: { instanceName } })
      if (existing) {
        return reply.status(409).send({ error: 'Instância já cadastrada' })
      }

      const creds = { baseUrl, apiKey }

      // Verify instance connection state
      const state = await getConnectionState(instanceName, creds)
      const isConnected = state === 'open' || state === 'CONNECTED'

      // Register webhook
      try {
        const webhookBase = env.WEBHOOK_BASE_URL ?? `${env.NEXT_PUBLIC_APP_URL}/api`
        const webhookUrl = `${webhookBase}/whatsapp/webhook/${instanceName}`
        await setWebhook(instanceName, webhookUrl, creds)
      } catch (e) {
        // Non-fatal: webhook setup can fail if already set
        app.log.warn(`Webhook setup warning for ${instanceName}: ${String(e)}`)
      }

      const number = await prisma.whatsappNumber.create({
        data: {
          phone,
          instanceName,
          apiUrl: baseUrl,
          apiKey,
          userId: user.id,
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
        },
      })

      return reply.status(201).send(number)
    }
  )

  // Legacy: create instance with QR code
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

      const instanceName = `cashmind_${ownerId.replace(/-/g, '').slice(0, 12)}_${Date.now()}`

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
      const creds = number.apiUrl && number.apiKey
        ? { baseUrl: number.apiUrl, apiKey: number.apiKey }
        : undefined
      const { qrcode } = await getQRCode(number.instanceName, creds)
      return reply.send({ qrcode })
    }
  )

  // Re-register webhook for an existing number (useful when public URL changes)
  app.post(
    '/whatsapp/numbers/:id/setup-webhook',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      console.log(`[setup-webhook] id=${id}`)

      try {
        const number = await prisma.whatsappNumber.findUnique({ where: { id } })
        if (!number) return reply.status(404).send({ error: 'Número não encontrado' })

        if (!number.apiUrl || !number.apiKey) {
          return reply.status(400).send({
            error: 'Credenciais da Evolution API não encontradas. Remova e reconecte o número informando URL e token.',
          })
        }

        const creds = { baseUrl: number.apiUrl, apiKey: number.apiKey }

        const webhookBase = env.WEBHOOK_BASE_URL ?? `${env.NEXT_PUBLIC_APP_URL}/api`
        const webhookUrl = `${webhookBase}/whatsapp/webhook/${number.instanceName}`

        console.log(`[setup-webhook] calling setWebhook → ${webhookUrl}`)
        await setWebhook(number.instanceName, webhookUrl, creds)
        console.log(`[setup-webhook] success`)

        if (!reply.sent) return reply.send({ ok: true, webhookUrl })
        return reply
      } catch (err) {
        console.error(`[setup-webhook] error:`, err)
        const raw = err instanceof Error ? err.message : String(err)
        const match = raw.match(/Evolution API error \d+: (.+)/)
        const msg = match ? match[1] : raw
        if (!reply.sent) return reply.status(500).send({ error: msg })
        return reply
      }
    }
  )

  // Verify/refresh status of an existing API-connected number
  app.post(
    '/whatsapp/numbers/:id/verify',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const number = await prisma.whatsappNumber.findUnique({ where: { id } })
        if (!number) return reply.status(404).send({ error: 'Número não encontrado' })

        const creds = number.apiUrl && number.apiKey
          ? { baseUrl: number.apiUrl, apiKey: number.apiKey }
          : undefined

        const state = await getConnectionState(number.instanceName, creds)
        const isConnected = state === 'open' || state === 'CONNECTED' || state === 'connecting'

        const updated = await prisma.whatsappNumber.update({
          where: { id },
          data: { status: isConnected ? 'CONNECTED' : 'DISCONNECTED' },
        })

        // Don't expose apiKey in response
        const { apiKey: _k, ...safe } = updated as typeof updated & { apiKey?: string }
        return reply.send(safe)
      } catch (err) {
        app.log.error(`verify error: ${String(err)}`)
        return reply.status(500).send({ error: 'Erro ao verificar status' })
      }
    }
  )

  app.delete(
    '/whatsapp/numbers/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const number = await prisma.whatsappNumber.findUniqueOrThrow({ where: { id } })

      try {
        const creds = number.apiUrl && number.apiKey
          ? { baseUrl: number.apiUrl, apiKey: number.apiKey }
          : undefined
        await deleteInstance(number.instanceName, creds)
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

      const creds = conversation.number.apiUrl && conversation.number.apiKey
        ? { baseUrl: conversation.number.apiUrl, apiKey: conversation.number.apiKey }
        : undefined

      const remoteId = await sendTextMessage(
        conversation.number.instanceName,
        conversation.remoteJid,
        text,
        creds
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

  // Start a new conversation with a lead (outbound first message)
  app.post(
    '/whatsapp/conversations/start',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      let leadId: string, numberId: string, text: string
      try {
        const parsed = z.object({
          leadId: z.string(),
          numberId: z.string(),
          text: z.string().min(1),
        }).parse(request.body)
        leadId = parsed.leadId
        numberId = parsed.numberId
        text = parsed.text
      } catch {
        return reply.status(400).send({ error: 'Dados inválidos' })
      }

      const [lead, number] = await Promise.all([
        prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
        prisma.whatsappNumber.findUniqueOrThrow({ where: { id: numberId } }),
      ])

      const rawPhone = (lead.whatsapp ?? lead.phone ?? '').replace(/\D/g, '')
      if (!rawPhone) return reply.status(400).send({ error: 'Lead sem número de WhatsApp ou telefone' })

      // Normalize to include Brazil country code (55) if missing
      let phone = rawPhone
      if (!phone.startsWith('55') && phone.length <= 11) {
        phone = `55${phone}`
      }

      const remoteJid = `${phone}@s.whatsapp.net`

      const creds = number.apiUrl && number.apiKey
        ? { baseUrl: number.apiUrl, apiKey: number.apiKey }
        : undefined

      let remoteId: string
      try {
        remoteId = await sendTextMessage(number.instanceName, remoteJid, text, creds)
      } catch (err) {
        app.log.error(`sendTextMessage error: ${String(err)}`)
        return reply.status(502).send({ error: `Erro ao enviar via Evolution API: ${String(err)}` })
      }

      // Find or create conversation
      let conversation = await prisma.whatsappConversation.findUnique({
        where: { numberId_remoteJid: { numberId: number.id, remoteJid } },
      })

      if (!conversation) {
        conversation = await prisma.whatsappConversation.create({
          data: {
            remoteJid,
            remotePhone: phone,
            remoteName: lead.name,
            numberId: number.id,
            leadId: lead.id,
            lastMessage: text,
            lastMessageAt: new Date(),
            unreadCount: 0,
          },
        })
      } else {
        await prisma.whatsappConversation.update({
          where: { id: conversation.id },
          data: { lastMessage: text, lastMessageAt: new Date(), leadId: lead.id },
        })
      }

      const message = await prisma.whatsappMessage.create({
        data: {
          remoteId,
          conversationId: conversation.id,
          content: text,
          type: 'TEXT',
          fromMe: true,
          status: 'SENT',
          timestamp: new Date(),
        },
      })

      app.io.to(`conversation:${conversation.id}`).emit('message:new', {
        conversationId: conversation.id,
        message,
      })

      return reply.status(201).send({ conversation, message })
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
