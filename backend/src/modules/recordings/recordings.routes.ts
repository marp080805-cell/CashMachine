import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { storageService } from '../../lib/storage.service'
import { transcriptionQueue } from '../../queues'
import { recordingAnalysisQueue } from '../../queues/recording-analysis.queue'

export default async function recordingsRoutes(app: FastifyInstance) {
  // POST /recordings/upload — multipart upload
  app.post('/recordings/upload', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: userId } = request.user as { tenantId: string; id: string }

    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    const opportunityId = (request.query as any).opportunityId as string | undefined
    const meetingId = (request.query as any).meetingId as string | undefined
    const title = (request.query as any).title as string | undefined

    if (!opportunityId) {
      return reply.status(400).send({ error: 'opportunityId is required' })
    }

    // Verify opportunity belongs to tenant
    const opportunity = await prisma.opportunity.findFirstOrThrow({
      where: { id: opportunityId, tenantId },
    })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    const stored = await storageService.save(buffer, data.filename, data.mimetype)

    const recording = await prisma.recording.create({
      data: {
        tenantId,
        opportunityId,
        meetingId: meetingId ?? null,
        closerId: userId,
        title: title ?? data.filename,
        fileUrl: stored.url,
        fileSizeBytes: BigInt(stored.size),
        uploadStatus: 'PROCESSING',
      },
    })

    // Enqueue transcription
    await transcriptionQueue.add('transcribe-recording', {
      recordingId: recording.id,
      audioUrl: stored.url,
      opportunityId,
    })

    return reply.status(201).send(recording)
  })

  // GET /recordings
  app.get('/recordings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { opportunityId, status, closerId, page = 1, limit = 20 } = request.query as any

    const where: any = {
      tenantId,
      ...(opportunityId && { opportunityId }),
      ...(status && { uploadStatus: status }),
      ...(closerId && { closerId }),
    }

    const recordings = await prisma.recording.findMany({
      where,
      include: {
        closer: { select: { id: true, name: true, avatarUrl: true } },
        opportunity: { select: { id: true, title: true } },
        meeting: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })

    return reply.send(recordings)
  })

  // GET /recordings/:id
  app.get('/recordings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const recording = await prisma.recording.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        closer: { select: { id: true, name: true, avatarUrl: true } },
        opportunity: { select: { id: true, title: true, contact: { select: { id: true, name: true } } } },
        meeting: { select: { id: true, title: true, startDatetime: true } },
      },
    })

    return reply.send(recording)
  })

  // POST /recordings/:id/analyze — force re-analysis
  app.post('/recordings/:id/analyze', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const recording = await prisma.recording.findFirstOrThrow({
      where: { id, tenantId },
    })

    if (!recording.transcriptionText) {
      return reply.status(400).send({ error: 'Recording has no transcription yet. Transcribe first.' })
    }

    await prisma.recording.update({
      where: { id },
      data: { uploadStatus: 'ANALYZING' },
    })

    await recordingAnalysisQueue.add('analyze-recording', { recordingId: id })

    return reply.send({ success: true, message: 'Analysis queued' })
  })
}
