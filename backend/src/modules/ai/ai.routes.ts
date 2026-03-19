import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { transcriptionQueue } from '../../queues'
import type { UserRole } from '@prisma/client'

export default async function aiRoutes(app: FastifyInstance) {
  app.get(
    '/transcriptions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as { id: string; role: UserRole }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)

      const transcriptions = await prisma.callTranscription.findMany({
        where: isAdmin ? {} : { uploadedById: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      return reply.send(transcriptions)
    }
  )

  app.get(
    '/transcriptions/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const transcription = await prisma.callTranscription.findUniqueOrThrow({ where: { id } })
      return reply.send(transcription)
    }
  )

  app.post(
    '/transcriptions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = z.object({
        title: z.string().min(1),
        audioUrl: z.string().url(),
        leadId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
      }).parse(request.body)

      const user = request.user as { id: string }

      const transcription = await prisma.callTranscription.create({
        data: {
          ...input,
          uploadedById: user.id,
          status: 'PENDING',
        },
      })

      await transcriptionQueue.add('transcribe', {
        transcriptionId: transcription.id,
        audioUrl: input.audioUrl,
        dealId: input.dealId,
      })

      return reply.status(201).send(transcription)
    }
  )

  app.post(
    '/ai/suggest',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { conversationId } = z.object({ conversationId: z.string().uuid() }).parse(request.body)

      const conversation = await prisma.whatsappConversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: {
          messages: { orderBy: { timestamp: 'desc' }, take: 10 },
          lead: true,
        },
      })

      const lastMessage = conversation.messages[0]
      if (!lastMessage?.content) {
        return reply.status(400).send({ error: 'No message content to suggest from' })
      }

      const { generateWhatsappSuggestion } = await import('./ai.service')
      const suggestion = await generateWhatsappSuggestion(
        conversation.messages.reverse().map((m) => ({
          content: m.content ?? '',
          fromMe: m.fromMe,
          timestamp: m.timestamp.toISOString(),
        })),
        conversation.lead ? `Nome: ${conversation.lead.name}, Status: ${conversation.lead.status}` : null,
        lastMessage.content
      )

      await prisma.whatsappMessage.update({
        where: { id: lastMessage.id },
        data: { aiSuggestion: suggestion },
      })

      app.io.to(`conversation:${conversationId}`).emit('ai:suggestion', {
        conversationId,
        messageId: lastMessage.id,
        suggestion,
      })

      return reply.send({ suggestion })
    }
  )
}
