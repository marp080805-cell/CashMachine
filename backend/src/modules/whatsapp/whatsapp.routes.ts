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
import type { EvolutionWebhookPayload } from './evolution.client'
import { env } from '../../config/env'
import { normalizePhone, getPhoneVariants } from '../../lib/phone'

export default async function whatsappRoutes(app: FastifyInstance) {
  app.get('/whatsapp/numbers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as { tenantId: string; id: string; role: string }
    const isManager = ['ADMIN', 'MANAGER'].includes(role)

    const numbers = await prisma.whatsappNumber.findMany({
      where: { tenantId, ...(!isManager && { userId }) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ numbers })
  })

  // Conectar via credenciais da API
  app.post('/whatsapp/numbers/connect', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { baseUrl, instanceName, apiKey, phone } = z.object({
      baseUrl: z.string().url(),
      instanceName: z.string().min(1),
      apiKey: z.string().min(1),
      phone: z.string().min(1),
    }).parse(request.body)

    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    const existing = await prisma.whatsappNumber.findUnique({ where: { instanceName } })
    if (existing) {
      return reply.status(409).send({ error: 'Instância já cadastrada' })
    }

    const creds = { baseUrl, apiKey }
    const state = await getConnectionState(instanceName, creds)
    const isConnected = state === 'open' || state === 'CONNECTED'

    try {
      const webhookBase = env.WEBHOOK_BASE_URL ?? `${env.NEXT_PUBLIC_APP_URL}/api`
      await setWebhook(instanceName, `${webhookBase}/whatsapp/webhook/${instanceName}`, creds)
    } catch (e) {
      app.log.warn(`Webhook setup warning for ${instanceName}: ${String(e)}`)
    }

    const number = await prisma.whatsappNumber.create({
      data: {
        phone, instanceName, apiUrl: baseUrl, apiKey,
        userId, tenantId,
        status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      },
    })

    return reply.status(201).send(number)
  })

  // Legacy: criar via QR code
  app.post('/whatsapp/numbers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }
    const instanceName = `cm_${tenantId.replace(/-/g, '').slice(0, 8)}_${Date.now()}`

    await createInstance(instanceName)
    const { qrcode } = await getQRCode(instanceName)

    const number = await prisma.whatsappNumber.create({
      data: { phone: `pending_${instanceName}`, instanceName, userId, tenantId, status: 'CONNECTING' },
    })

    return reply.status(201).send({ ...number, qrcode })
  })

  app.get('/whatsapp/numbers/:id/qrcode', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const number = await prisma.whatsappNumber.findUniqueOrThrow({ where: { id } })
    const creds = number.apiUrl && number.apiKey ? { baseUrl: number.apiUrl, apiKey: number.apiKey } : undefined
    const { qrcode } = await getQRCode(number.instanceName, creds)
    return reply.send({ qrcode })
  })

  app.post('/whatsapp/numbers/:id/setup-webhook', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const number = await prisma.whatsappNumber.findUnique({ where: { id } })
      if (!number) return reply.status(404).send({ error: 'Número não encontrado' })
      if (!number.apiUrl || !number.apiKey) {
        return reply.status(400).send({ error: 'Credenciais da Evolution API não encontradas.' })
      }
      const creds = { baseUrl: number.apiUrl, apiKey: number.apiKey }
      const webhookBase = env.WEBHOOK_BASE_URL ?? `${env.NEXT_PUBLIC_APP_URL}/api`
      const webhookUrl = `${webhookBase}/whatsapp/webhook/${number.instanceName}`
      await setWebhook(number.instanceName, webhookUrl, creds)
      return reply.send({ ok: true, webhookUrl })
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const match = raw.match(/Evolution API error \d+: (.+)/)
      return reply.status(500).send({ error: match ? match[1] : raw })
    }
  })

  app.post('/whatsapp/numbers/:id/verify', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const number = await prisma.whatsappNumber.findUnique({ where: { id } })
    if (!number) return reply.status(404).send({ error: 'Número não encontrado' })
    const creds = number.apiUrl && number.apiKey ? { baseUrl: number.apiUrl, apiKey: number.apiKey } : undefined
    const state = await getConnectionState(number.instanceName, creds)
    const isConnected = ['open', 'CONNECTED', 'connecting'].includes(state)
    const updated = await prisma.whatsappNumber.update({
      where: { id },
      data: { status: isConnected ? 'CONNECTED' : 'DISCONNECTED' },
    })
    const { apiKey: _k, ...safe } = updated as typeof updated & { apiKey?: string }
    return reply.send(safe)
  })

  app.delete('/whatsapp/numbers/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const number = await prisma.whatsappNumber.findUniqueOrThrow({ where: { id } })
    try {
      const creds = number.apiUrl && number.apiKey ? { baseUrl: number.apiUrl, apiKey: number.apiKey } : undefined
      await deleteInstance(number.instanceName, creds)
    } catch {
      // Instance may not exist on evolution API
    }
    // Delete conversations (messages cascade via onDelete: Cascade)
    await prisma.whatsappConversation.deleteMany({ where: { numberId: id } })
    await prisma.whatsappNumber.delete({ where: { id } })
    return reply.send({ success: true })
  })

  app.get('/whatsapp/conversations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId, role } = request.user as { tenantId: string; id: string; role: string }
    const { page = 1, limit = 20, archived = false, unreadOnly = false, search, contactId } = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
      archived: z.coerce.boolean().default(false),
      unreadOnly: z.coerce.boolean().default(false),
      search: z.string().optional(),
      contactId: z.string().uuid().optional(),
    }).parse(request.query)

    const isManager = ['ADMIN', 'MANAGER'].includes(role)
    const numberIds = await prisma.whatsappNumber.findMany({
      where: { tenantId, ...(!isManager && { userId }) },
      select: { id: true },
    }).then((ns) => ns.map((n) => n.id))

    const where: any = { numberId: { in: numberIds }, isArchived: archived }
    if (unreadOnly) where.unreadCount = { gt: 0 }
    if (contactId) where.contactId = contactId
    if (search) {
      where.OR = [
        { remoteName: { contains: search, mode: 'insensitive' } },
        { remotePhone: { contains: search } },
      ]
    }

    const [conversations, total] = await Promise.all([
      prisma.whatsappConversation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          number: { select: { id: true, phone: true, status: true } },
          contact: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.whatsappConversation.count({ where }),
    ])

    return reply.send({ conversations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  })

  app.get('/whatsapp/conversations/:id/messages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { cursor, limit = 50 } = z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().default(50),
    }).parse(request.query)

    const messages = await prisma.whatsappMessage.findMany({
      where: { conversationId: id, ...(cursor ? { timestamp: { lt: new Date(cursor) } } : {}) },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    return reply.send({
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?.timestamp.toISOString() : null,
    })
  })

  app.post('/whatsapp/conversations/:id/send', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { text } = z.object({ text: z.string().min(1) }).parse(request.body)

    const conversation = await prisma.whatsappConversation.findUniqueOrThrow({
      where: { id },
      include: { number: true },
    })

    const creds = conversation.number.apiUrl && conversation.number.apiKey
      ? { baseUrl: conversation.number.apiUrl, apiKey: conversation.number.apiKey }
      : undefined

    const remoteId = await sendTextMessage(conversation.number.instanceName, conversation.remoteJid, text, creds)

    const message = await prisma.whatsappMessage.create({
      data: { remoteId, conversationId: id, content: text, type: 'TEXT', fromMe: true, status: 'SENT', timestamp: new Date() },
    })

    await prisma.whatsappConversation.update({
      where: { id },
      data: { lastMessage: text, lastMessageAt: new Date() },
    })

    app.io.to(`conversation:${id}`).emit('message:new', { conversationId: id, message })

    return reply.status(201).send(message)
  })

  app.patch('/whatsapp/conversations/:id/read', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.whatsappConversation.update({ where: { id }, data: { unreadCount: 0 } })
    return reply.send({ success: true })
  })

  // Configuração de IA por conversa (ativar/desativar + selecionar agente)
  app.patch('/whatsapp/conversations/:id/ai-config', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({
      aiEnabled: z.boolean().optional(),
      aiAgentId: z.string().nullable().optional(),
    }).parse(request.body)

    const conversation = await prisma.whatsappConversation.update({
      where: { id },
      data: {
        ...(body.aiEnabled !== undefined && { aiEnabled: body.aiEnabled }),
        ...(body.aiAgentId !== undefined && { aiAgentId: body.aiAgentId }),
      },
    })

    return reply.send({ aiEnabled: conversation.aiEnabled, aiAgentId: conversation.aiAgentId })
  })

  // Merge de conversas duplicadas (mesmo telefone, variantes 9/8-dígito BR)
  app.post('/whatsapp/conversations/merge-duplicates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const numberIds = await prisma.whatsappNumber.findMany({
      where: { tenantId },
      select: { id: true },
    }).then((ns) => ns.map((n) => n.id))

    const allConvs = await prisma.whatsappConversation.findMany({
      where: { numberId: { in: numberIds } },
      orderBy: [{ contactId: 'asc' }, { lastMessageAt: 'desc' }],
    })

    const merged: string[] = []

    // Agrupa por numberId + sufixo de 8 dígitos
    const groups = new Map<string, typeof allConvs>()
    for (const conv of allConvs) {
      const key = `${conv.numberId}:${conv.remotePhone.slice(-8)}`
      const g = groups.get(key) ?? []
      g.push(conv)
      groups.set(key, g)
    }

    for (const group of groups.values()) {
      if (group.length <= 1) continue
      // canonical = primeiro com contactId, ou simplesmente o primeiro
      const canonical = group.find((c) => c.contactId !== null) ?? group[0]!
      const duplicates = group.filter((c) => c.id !== canonical.id)

      for (const dup of duplicates) {
        await prisma.whatsappMessage.updateMany({
          where: { conversationId: dup.id },
          data: { conversationId: canonical.id },
        })
        await prisma.notification.deleteMany({ where: { link: { contains: dup.id } } })
        try {
          await prisma.whatsappConversation.delete({ where: { id: dup.id } })
          merged.push(dup.id)
        } catch { /* ignore */ }
      }
    }

    return reply.send({ merged: merged.length, ids: merged })
  })

  // Vincular conversa a um Contact
  app.post('/whatsapp/conversations/:id/link-contact', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contactId } = z.object({ contactId: z.string().uuid() }).parse(request.body)

    const conversation = await prisma.whatsappConversation.update({
      where: { id },
      data: { contactId },
      include: { contact: { select: { id: true, name: true } } },
    })

    return reply.send(conversation)
  })

  // Iniciar conversa outbound com um contato
  app.post('/whatsapp/conversations/start', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { contactId, numberId, text } = z.object({
      contactId: z.string().uuid(),
      numberId: z.string().uuid(),
      text: z.string().min(1),
    }).parse(request.body)

    const { tenantId } = request.user as { tenantId: string }

    const [contact, number] = await Promise.all([
      prisma.contact.findFirstOrThrow({ where: { id: contactId, tenantId } }),
      prisma.whatsappNumber.findFirstOrThrow({ where: { id: numberId, tenantId } }),
    ])

    const phone = normalizePhone(contact.phone)
    if (!phone) return reply.status(400).send({ error: 'Contato sem número de telefone' })

    const remoteJid = `${phone}@s.whatsapp.net`
    const creds = number.apiUrl && number.apiKey ? { baseUrl: number.apiUrl, apiKey: number.apiKey } : undefined

    let remoteId: string
    try {
      remoteId = await sendTextMessage(number.instanceName, remoteJid, text, creds)
    } catch (err) {
      return reply.status(502).send({ error: `Erro ao enviar via Evolution API: ${String(err)}` })
    }

    let conversation = await prisma.whatsappConversation.findUnique({
      where: { numberId_remoteJid: { numberId: number.id, remoteJid } },
    })

    if (!conversation) {
      conversation = await prisma.whatsappConversation.create({
        data: {
          remoteJid, remotePhone: phone, remoteName: contact.name,
          numberId: number.id, contactId: contact.id,
          lastMessage: text, lastMessageAt: new Date(), unreadCount: 0,
        },
      })
    } else {
      await prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: { lastMessage: text, lastMessageAt: new Date(), contactId: contact.id },
      })
    }

    const message = await prisma.whatsappMessage.create({
      data: {
        remoteId, conversationId: conversation.id,
        content: text, type: 'TEXT', fromMe: true, status: 'SENT', timestamp: new Date(),
      },
    })

    app.io.to(`conversation:${conversation.id}`).emit('message:new', { conversationId: conversation.id, message })

    return reply.status(201).send({ conversation, message })
  })

  app.post('/whatsapp/webhook/:instanceName', async (request, reply) => {
    const { instanceName } = request.params as { instanceName: string }
    const payload = request.body as EvolutionWebhookPayload
    await handleIncomingWebhook(app, instanceName, payload)
    return reply.status(200).send({ ok: true })
  })
}
