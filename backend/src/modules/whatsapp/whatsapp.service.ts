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
  if (payload.event !== 'messages.upsert') return

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

    conversation = await prisma.whatsappConversation.create({
      data: {
        remoteJid: parsed.remoteJid,
        remotePhone,
        remoteName: parsed.remoteName,
        numberId: whatsappNumber.id,
        leadId: leadMatch?.id,
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

  await prisma.whatsappMessage.upsert({
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
    message: {
      remoteId: parsed.messageId,
      content: parsed.content,
      type: parsed.type,
      fromMe: parsed.fromMe,
      timestamp: parsed.timestamp,
    },
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
