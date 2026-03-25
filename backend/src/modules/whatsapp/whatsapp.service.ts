import { prisma } from '../../lib/prisma'
import type { EvolutionWebhookPayload } from './evolution.client'
import { parseWebhookMessage } from './evolution.client'
import { aiSuggestionQueue } from '../../queues'
import type { FastifyInstance } from 'fastify'
import type { MessageType, MessageStatus } from '@prisma/client'

export async function handleIncomingWebhook(
  app: FastifyInstance,
  instanceName: string,
  payload: EvolutionWebhookPayload
): Promise<void> {
  if (payload.event === 'connection.update') {
    const state = (payload.data as { state?: string; instance?: { profileJid?: string } })
    const status = state?.state === 'open' ? 'CONNECTED'
      : state?.state === 'close' ? 'DISCONNECTED'
      : state?.state === 'connecting' ? 'CONNECTING'
      : null

    if (status) {
      const phone = (state as { instance?: { profileJid?: string } }).instance?.profileJid
        ?.replace('@s.whatsapp.net', '') ?? undefined

      await prisma.whatsappNumber.updateMany({
        where: { instanceName },
        data: {
          status: status as 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING',
          ...(phone ? { phone } : {}),
        },
      })

      const number = await prisma.whatsappNumber.findUnique({ where: { instanceName } })
      if (number) {
        app.io.to(`user:${number.userId}`).emit('whatsapp:status', { instanceName, status })
      }
    }
    return
  }

  // Handle delivery/read status updates
  if (payload.event === 'messages.update') {
    const updates = Array.isArray(payload.data) ? payload.data : [payload.data]
    for (const upd of updates as Array<{ key?: { id?: string }; update?: { status?: string } }>) {
      const remoteId = upd.key?.id
      const rawStatus = upd.update?.status
      if (!remoteId || !rawStatus) continue

      const statusMap: Record<string, string> = {
        DELIVERY_ACK: 'DELIVERED',
        READ: 'READ',
        PLAYED: 'READ',
        SERVER_ACK: 'SENT',
        PENDING: 'PENDING',
      }
      const status = statusMap[rawStatus] ?? null
      if (!status) continue

      const msg = await prisma.whatsappMessage.findUnique({ where: { remoteId } })
      if (!msg) continue

      await prisma.whatsappMessage.update({
        where: { remoteId },
        data: { status: status as MessageStatus },
      })

      app.io.to(`conversation:${msg.conversationId}`).emit('message:status', {
        conversationId: msg.conversationId,
        remoteId,
        status,
      })
    }
    return
  }

  if (payload.event !== 'messages.upsert') return

  const rawData = payload.data as { status?: string; message?: unknown }
  if (!rawData.message) return

  const parsed = parseWebhookMessage(payload)

  const whatsappNumber = await prisma.whatsappNumber.findUnique({ where: { instanceName } })
  if (!whatsappNumber) return

  const remotePhone = parsed.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

  let conversation = await prisma.whatsappConversation.findUnique({
    where: { numberId_remoteJid: { numberId: whatsappNumber.id, remoteJid: parsed.remoteJid } },
  })

  if (!conversation) {
    // Buscar Contact pelo telefone (dentro do mesmo tenant)
    const contactMatch = await prisma.contact.findFirst({
      where: {
        tenantId: whatsappNumber.tenantId,
        phone: { contains: remotePhone },
      },
    })

    let contactId = contactMatch?.id

    if (!contactId && !parsed.fromMe) {
      // Criar contato automaticamente para mensagens recebidas
      const newContact = await prisma.contact.create({
        data: {
          tenantId: whatsappNumber.tenantId,
          name: parsed.remoteName ?? remotePhone,
          phone: remotePhone,
        },
      })
      contactId = newContact.id
    }

    conversation = await prisma.whatsappConversation.create({
      data: {
        remoteJid: parsed.remoteJid,
        remotePhone,
        remoteName: parsed.remoteName,
        numberId: whatsappNumber.id,
        contactId,
        lastMessage: parsed.content,
        lastMessageAt: parsed.timestamp,
        unreadCount: parsed.fromMe ? 0 : 1,
      },
    })
  } else {
    await prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: parsed.content,
        lastMessageAt: parsed.timestamp,
        remoteName: parsed.remoteName ?? conversation.remoteName,
        unreadCount: parsed.fromMe ? conversation.unreadCount : conversation.unreadCount + 1,
      },
    })
  }

  const savedMessage = await prisma.whatsappMessage.upsert({
    where: { remoteId: parsed.messageId },
    create: {
      remoteId: parsed.messageId,
      conversationId: conversation.id,
      content: parsed.content,
      type: parsed.type as MessageType,
      mediaUrl: parsed.mediaUrl,
      fromMe: parsed.fromMe,
      status: 'DELIVERED' as MessageStatus,
      timestamp: parsed.timestamp,
    },
    update: {},
  })

  app.io.to(`conversation:${conversation.id}`).emit('message:new', {
    conversationId: conversation.id,
    message: savedMessage,
  })

  app.io.to(`user:${whatsappNumber.userId}`).emit('conversation:updated', {
    conversationId: conversation.id,
    lastMessage: parsed.content,
    lastMessageAt: parsed.timestamp,
    unreadDelta: parsed.fromMe ? 0 : 1,
  })

  if (!parsed.fromMe) {
    await prisma.notification.create({
      data: {
        tenantId: whatsappNumber.tenantId,
        userId: whatsappNumber.userId,
        type: 'WHATSAPP_MESSAGE',
        title: 'Nova mensagem WhatsApp',
        body: `${parsed.remoteName ?? remotePhone}: ${parsed.content?.substring(0, 80) ?? '(mídia)'}`,
        link: `/whatsapp?conversation=${conversation.id}`,
      },
    })

    app.io.to(`user:${whatsappNumber.userId}`).emit('notification:new', {
      type: 'WHATSAPP_MESSAGE',
      conversationId: conversation.id,
    })

    await aiSuggestionQueue.add('generate-suggestion', {
      conversationId: conversation.id,
      incomingMessage: parsed.content ?? '',
      contactId: conversation.contactId,
    })
  }
}
