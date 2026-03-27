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
      const user = request.user as { id: string; role: UserRole; tenantId: string }
      const isAdmin = ['ADMIN', 'GESTOR'].includes(user.role)

      const transcriptions = await prisma.callTranscription.findMany({
        where: isAdmin ? { tenantId: user.tenantId } : { tenantId: user.tenantId, uploadedById: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      return reply.send({ transcriptions })
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
      const user = request.user as { id: string; tenantId: string }

      const data = await request.file()

      let audioUrl: string | null = null
      let title = `Gravação ${new Date().toLocaleDateString('pt-BR')}`

      if (data) {
        const { createClient } = await import('@supabase/supabase-js')
        const { env } = await import('../../config/env')
        const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string)

        const chunks: Buffer[] = []
        for await (const chunk of data.file) {
          chunks.push(chunk as Buffer)
        }
        const buffer = Buffer.concat(chunks)
        const fileName = `transcriptions/${user.id}/${Date.now()}-${data.filename}`

        const { data: uploadData, error } = await supabase.storage
          .from('cashmind')
          .upload(fileName, buffer, { contentType: data.mimetype, upsert: false })

        if (!error && uploadData) {
          const { data: urlData } = supabase.storage.from('cashmind').getPublicUrl(uploadData.path)
          audioUrl = urlData.publicUrl
          title = data.filename.replace(/\.[^/.]+$/, '') || title
        }
      } else {
        const input = z.object({
          title: z.string().min(1).optional(),
          audioUrl: z.string().url(),
          leadId: z.string().uuid().optional(),
          dealId: z.string().uuid().optional(),
        }).parse(request.body)
        audioUrl = input.audioUrl
        if (input.title) title = input.title
      }

      const transcription = await prisma.callTranscription.create({
        data: {
          title,
          audioUrl,
          uploadedById: user.id,
          tenantId: user.tenantId,
          status: 'PENDING',
        },
      })

      if (audioUrl) {
        await transcriptionQueue.add('transcribe', {
          transcriptionId: transcription.id,
          audioUrl,
          opportunityId: null,
        })
      }

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
          contact: true,
        },
      })

      const lastMessage = conversation.messages[0]
      if (!lastMessage?.content) {
        return reply.status(400).send({ error: 'No message content to suggest from' })
      }

      const { generateWhatsappSuggestion } = await import('./ai.service')
      const suggestion = await generateWhatsappSuggestion(
        conversation.messages.reverse().map((m: { content: string | null; fromMe: boolean; timestamp: Date }) => ({
          content: m.content ?? '',
          fromMe: m.fromMe,
          timestamp: m.timestamp.toISOString(),
        })),
        conversation.contact ? `Nome: ${conversation.contact.name}` : null,
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
