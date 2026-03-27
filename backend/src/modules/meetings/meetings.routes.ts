import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const meetingTypeEnum = z.enum([
  'INITIAL_CONSULTATION',
  'FOLLOW_UP_MEETING',
  'PROPOSAL_PRESENTATION',
  'CLOSING_MEETING',
  'ONBOARDING',
  'RETURN_VISIT',
  'CUSTOM',
])

const locationTypeEnum = z.enum(['IN_PERSON', 'VIDEO_CALL', 'PHONE_CALL'])
const meetingStatusEnum = z.enum(['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'NO_SHOW', 'CANCELLED', 'COMPLETED'])

const createMeetingSchema = z.object({
  opportunityId: z.string().uuid(),
  contactId: z.string().uuid(),
  hostId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  meetingType: meetingTypeEnum.default('INITIAL_CONSULTATION'),
  startDatetime: z.string().datetime(),
  endDatetime: z.string().datetime(),
  durationMinutes: z.number().int().default(60),
  locationType: locationTypeEnum.default('VIDEO_CALL'),
  locationDetails: z.string().optional(),
  videoLink: z.string().optional(),
  sdrBriefing: z.string().optional(),
  closerNotes: z.string().optional(),
})

const updateMeetingSchema = createMeetingSchema.partial()

const meetingIncludes = {
  contact: { select: { id: true, name: true, email: true, phone: true } },
  opportunity: { select: { id: true, title: true } },
  organizer: { select: { id: true, name: true, avatarUrl: true } },
  host: { select: { id: true, name: true, avatarUrl: true } },
}

const createBookingPageSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1),
  description: z.string().optional(),
  meetingType: meetingTypeEnum.default('INITIAL_CONSULTATION'),
  durationMinutes: z.number().int().default(60),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  requiredFields: z.any().optional(),
  confirmationMessage: z.string().optional(),
  reminderConfig: z.any().optional(),
  styling: z.any().optional(),
  isActive: z.boolean().default(true),
})

const bookingScheduleSchema = z.object({
  contactName: z.string().min(1),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  startDatetime: z.string().datetime(),
  endDatetime: z.string().datetime(),
  notes: z.string().optional(),
})

export default async function meetingsRoutes(app: FastifyInstance) {
  // ─── Meetings ─────────────────────────────────────────────────────

  app.get('/meetings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const {
      opportunityId,
      contactId,
      status,
      hostId,
      page = '1',
      limit = '50',
    } = request.query as any

    const where: any = {
      tenantId,
      ...(opportunityId && { opportunityId }),
      ...(contactId && { contactId }),
      ...(status && { status }),
      ...(hostId && { hostId }),
    }

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        include: meetingIncludes,
        orderBy: { startDatetime: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.meeting.count({ where }),
    ])

    return reply.send({ meetings, total, page: Number(page), limit: Number(limit) })
  })

  app.post('/meetings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: organizerId } = request.user as { tenantId: string; id: string }
    const input = createMeetingSchema.parse(request.body)

    const meeting = await prisma.meeting.create({
      data: {
        ...input,
        tenantId,
        organizerId,
        startDatetime: new Date(input.startDatetime),
        endDatetime: new Date(input.endDatetime),
      },
      include: meetingIncludes,
    })

    return reply.status(201).send(meeting)
  })

  app.get('/meetings/availability/:userId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const { date } = request.query as { date?: string }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: 'date query param required in YYYY-MM-DD format' })
    }

    const dayStart = new Date(`${date}T08:00:00.000Z`)
    const dayEnd = new Date(`${date}T18:00:00.000Z`)

    // Buscar reuniões existentes do host no dia
    const existingMeetings = await prisma.meeting.findMany({
      where: {
        hostId: userId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startDatetime: { gte: dayStart, lt: dayEnd },
      },
      select: { startDatetime: true, endDatetime: true },
    })

    // Gerar slots de 30 minutos das 8h-18h
    const slots: { start: string; end: string; available: boolean }[] = []
    const slotDuration = 30 * 60 * 1000 // 30 min in ms
    let cursor = dayStart.getTime()

    while (cursor + slotDuration <= dayEnd.getTime()) {
      const slotStart = new Date(cursor)
      const slotEnd = new Date(cursor + slotDuration)

      const occupied = existingMeetings.some((m) => {
        const mStart = m.startDatetime.getTime()
        const mEnd = m.endDatetime.getTime()
        return slotStart.getTime() < mEnd && slotEnd.getTime() > mStart
      })

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available: !occupied,
      })

      cursor += slotDuration
    }

    return reply.send({ userId, date, slots })
  })

  app.get('/meetings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const meeting = await prisma.meeting.findFirstOrThrow({
      where: { id, tenantId },
      include: meetingIncludes,
    })

    return reply.send(meeting)
  })

  app.put('/meetings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = updateMeetingSchema.parse(request.body)

    await prisma.meeting.findFirstOrThrow({ where: { id, tenantId } })

    const data: any = { ...input }
    if (input.startDatetime) data.startDatetime = new Date(input.startDatetime)
    if (input.endDatetime) data.endDatetime = new Date(input.endDatetime)

    const meeting = await prisma.meeting.update({
      where: { id },
      data,
      include: meetingIncludes,
    })

    return reply.send(meeting)
  })

  app.delete('/meetings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.meeting.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.meeting.delete({ where: { id } })

    return reply.send({ success: true })
  })

  app.put('/meetings/:id/confirm', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.meeting.findFirstOrThrow({ where: { id, tenantId } })

    const meeting = await prisma.meeting.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
      include: meetingIncludes,
    })

    return reply.send(meeting)
  })

  app.put('/meetings/:id/reschedule', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: organizerId } = request.user as { tenantId: string; id: string }

    const rescheduleSchema = z.object({
      startDatetime: z.string().datetime(),
      endDatetime: z.string().datetime(),
      reason: z.string().optional(),
    })

    const { startDatetime, endDatetime } = rescheduleSchema.parse(request.body)

    const original = await prisma.meeting.findFirstOrThrow({ where: { id, tenantId } })

    // Marcar original como reagendada e criar nova
    await prisma.meeting.update({
      where: { id },
      data: { status: 'RESCHEDULED' },
    })

    const newMeeting = await prisma.meeting.create({
      data: {
        tenantId,
        opportunityId: original.opportunityId,
        contactId: original.contactId,
        organizerId,
        hostId: original.hostId,
        title: original.title,
        description: original.description ?? undefined,
        meetingType: original.meetingType,
        startDatetime: new Date(startDatetime),
        endDatetime: new Date(endDatetime),
        durationMinutes: original.durationMinutes,
        locationType: original.locationType,
        locationDetails: original.locationDetails ?? undefined,
        videoLink: original.videoLink ?? undefined,
        sdrBriefing: original.sdrBriefing ?? undefined,
        status: 'SCHEDULED',
        rescheduledFromId: id,
      },
      include: meetingIncludes,
    })

    return reply.send(newMeeting)
  })

  // ─── Booking Pages ────────────────────────────────────────────────

  app.get('/booking-pages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const pages = await prisma.bookingPage.findMany({
      where: { tenantId },
      include: { host: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(pages)
  })

  app.post('/booking-pages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId, id: hostId } = request.user as { tenantId: string; id: string }
    const input = createBookingPageSchema.parse(request.body)

    const existing = await prisma.bookingPage.findUnique({
      where: { tenantId_slug: { tenantId, slug: input.slug } },
    })
    if (existing) {
      return reply.status(409).send({ error: 'Slug already in use' })
    }

    const page = await prisma.bookingPage.create({
      data: { ...input, tenantId, hostId },
      include: { host: { select: { id: true, name: true, avatarUrl: true } } },
    })

    return reply.status(201).send(page)
  })

  app.put('/booking-pages/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createBookingPageSchema.partial().parse(request.body)

    await prisma.bookingPage.findFirstOrThrow({ where: { id, tenantId } })

    const page = await prisma.bookingPage.update({
      where: { id },
      data: input,
      include: { host: { select: { id: true, name: true, avatarUrl: true } } },
    })

    return reply.send(page)
  })

  app.delete('/booking-pages/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.bookingPage.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.bookingPage.delete({ where: { id } })

    return reply.send({ success: true })
  })

  // ─── Public Booking Routes (no auth) ─────────────────────────────

  app.get('/booking/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const page = await prisma.bookingPage.findFirst({
      where: { slug, isActive: true },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    if (!page) {
      return reply.status(404).send({ error: 'Booking page not found' })
    }

    return reply.send(page)
  })

  app.post('/booking/:slug/schedule', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const input = bookingScheduleSchema.parse(request.body)

    const bookingPage = await prisma.bookingPage.findFirst({
      where: { slug, isActive: true },
    })

    if (!bookingPage) {
      return reply.status(404).send({ error: 'Booking page not found' })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Upsert contact by phone or email
      let contact = await (async () => {
        if (input.contactPhone || input.contactEmail) {
          const found = await tx.contact.findFirst({
            where: {
              tenantId: bookingPage.tenantId,
              OR: [
                ...(input.contactPhone ? [{ phone: input.contactPhone }] : []),
                ...(input.contactEmail ? [{ email: input.contactEmail }] : []),
              ],
            },
          })
          if (found) return found
        }
        return tx.contact.create({
          data: {
            tenantId: bookingPage.tenantId,
            name: input.contactName,
            email: input.contactEmail,
            phone: input.contactPhone,
          },
        })
      })()

      // Resolve opportunityId
      let opportunityId: string

      if (bookingPage.pipelineId && bookingPage.stageId) {
        const opp = await tx.opportunity.create({
          data: {
            tenantId: bookingPage.tenantId,
            contactId: contact.id,
            pipelineId: bookingPage.pipelineId,
            stageId: bookingPage.stageId,
            assignedToId: bookingPage.hostId,
            title: `Reunião: ${input.contactName}`,
          },
        })
        opportunityId = opp.id
      } else {
        // Fallback: find first active pipeline
        const firstPipeline = await tx.pipeline.findFirst({
          where: { tenantId: bookingPage.tenantId, isActive: true },
          include: { stages: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        })

        if (!firstPipeline || !firstPipeline.stages[0]) {
          throw new Error('No pipeline configured for this tenant')
        }

        const opp = await tx.opportunity.create({
          data: {
            tenantId: bookingPage.tenantId,
            contactId: contact.id,
            pipelineId: firstPipeline.id,
            stageId: firstPipeline.stages[0].id,
            assignedToId: bookingPage.hostId,
            title: `Reunião: ${input.contactName}`,
          },
        })
        opportunityId = opp.id
      }

      // Create meeting
      const meeting = await tx.meeting.create({
        data: {
          tenantId: bookingPage.tenantId,
          opportunityId,
          contactId: contact.id,
          organizerId: bookingPage.hostId,
          hostId: bookingPage.hostId,
          title: bookingPage.title,
          description: input.notes ?? bookingPage.description ?? undefined,
          meetingType: bookingPage.meetingType,
          startDatetime: new Date(input.startDatetime),
          endDatetime: new Date(input.endDatetime),
          durationMinutes: bookingPage.durationMinutes,
          status: 'SCHEDULED',
        },
      })

      return { meeting, contact, opportunityId }
    })

    return reply.status(201).send(result)
  })

  // ─── Calendar Integrations ────────────────────────────────────────

  app.get('/calendar/integrations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }

    const integrations = await prisma.calendarIntegration.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        provider: true,
        calendarId: true,
        isActive: true,
        connectedAt: true,
        lastSyncedAt: true,
      },
    })

    return reply.send(integrations)
  })

  app.post('/calendar/integrations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }

    const schema = z.object({
      accessToken: z.string().min(1),
      refreshToken: z.string().optional(),
      calendarId: z.string().optional(),
      provider: z.enum(['GOOGLE_CALENDAR', 'OUTLOOK']).default('GOOGLE_CALENDAR'),
    })

    const { accessToken, refreshToken, calendarId, provider } = schema.parse(request.body)

    // Upsert by userId + provider
    const integration = await prisma.calendarIntegration.upsert({
      where: { userId_provider: { userId, provider } },
      update: {
        accessToken,
        refreshToken,
        calendarId,
        isActive: true,
        connectedAt: new Date(),
      },
      create: {
        userId,
        provider,
        accessToken,
        refreshToken,
        calendarId,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        calendarId: true,
        isActive: true,
        connectedAt: true,
      },
    })

    return reply.status(201).send(integration)
  })

  app.delete('/calendar/integrations/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }

    await prisma.calendarIntegration.findFirstOrThrow({ where: { id, userId } })
    await prisma.calendarIntegration.delete({ where: { id } })

    return reply.send({ success: true })
  })
}
