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

  if (payload.event !== 'messages.upsert') return

  // Skip delivery receipts / status-only updates that have no message body
  const rawData = payload.data as { status?: string; message?: unknown }
  if (!rawData.message) return

  const parsed = parseWebhookMessage(payload)

  const whatsappNumber = await prisma.whatsappNumber.findUnique({
    where: { instanceName },
  })

  if (!whatsappNumber) return

  const remotePhone = parsed.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

  let conversation = await prisma.whatsappConversation.findUnique({
    where: { numberId_remoteJid: { numberId: whatsappNumber.id, remoteJid: parsed.remoteJid } },
  })

  if (!conversation) {
    const leadMatch = await prisma.lead.findFirst({
      where: {
        OR: [
          { whatsapp: { contains: remotePhone } },
          { phone: { contains: remotePhone } },
        ],
      },
    })

    let leadId = leadMatch?.id

    if (!leadId && !parsed.fromMe) {
      const newLead = await prisma.lead.create({
        data: {
          name: parsed.remoteName ?? remotePhone,
          whatsapp: remotePhone,
          phone: remotePhone,
          status: 'NEW',
          createdById: whatsappNumber.userId,
        },
      })
      leadId = newLead.id
    }

    conversation = await prisma.whatsappConversation.create({
      data: {
        remoteJid: parsed.remoteJid,
        remotePhone,
        remoteName: parsed.remoteName,
        numberId: whatsappNumber.id,
        leadId,
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

  // Upsert and capture the full DB message (with id) for real-time socket emit
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

  // Emit full message (with DB id) so frontend deduplication works correctly
  app.io.to(`conversation:${conversation.id}`).emit('message:new', {
    conversationId: conversation.id,
    message: savedMessage,
  })

  // Also notify user room so the conversation list updates last-message
  app.io.to(`user:${whatsappNumber.userId}`).emit('conversation:updated', {
    conversationId: conversation.id,
    lastMessage: parsed.content,
    lastMessageAt: parsed.timestamp,
    unreadDelta: parsed.fromMe ? 0 : 1,
  })

  if (!parsed.fromMe) {
    await prisma.notification.create({
      data: {
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
      leadId: conversation.leadId,
    })
  }
}
