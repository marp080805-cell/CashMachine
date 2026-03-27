import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const formFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional().default(0),
})

const createFormSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  fields: z.array(formFieldSchema).default([]),
  pipelineId: z.string().uuid().optional(),
  initialStageId: z.string().uuid().optional(),
  autoAssignToId: z.string().uuid().optional(),
  utmTracking: z.boolean().default(true),
  redirectUrl: z.string().url().optional(),
  styling: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
})

export default async function formsRoutes(app: FastifyInstance) {
  // GET /forms (auth)
  app.get('/forms', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const forms = await prisma.form.findMany({
      where: { tenantId },
      include: {
        autoAssignTo: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(forms)
  })

  // POST /forms (auth)
  app.post('/forms', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const input = createFormSchema.parse(request.body)

    const form = await prisma.form.create({
      data: {
        ...input,
        tenantId,
        fields: input.fields as any,
        styling: input.styling as any,
      },
    })

    return reply.status(201).send(form)
  })

  // GET /forms/:id (auth)
  app.get('/forms/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const form = await prisma.form.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        autoAssignTo: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    })

    return reply.send(form)
  })

  // PUT /forms/:id (auth)
  app.put('/forms/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const input = createFormSchema.partial().parse(request.body)

    await prisma.form.findFirstOrThrow({ where: { id, tenantId } })

    const form = await prisma.form.update({
      where: { id },
      data: {
        ...input,
        ...(input.fields !== undefined && { fields: input.fields as any }),
        ...(input.styling !== undefined && { styling: input.styling as any }),
      },
    })

    return reply.send(form)
  })

  // DELETE /forms/:id (auth)
  app.delete('/forms/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    await prisma.form.findFirstOrThrow({ where: { id, tenantId } })
    await prisma.form.delete({ where: { id } })

    return reply.send({ success: true })
  })

  // GET /forms/:slug/public — PUBLIC (no auth)
  app.get('/forms/:slug/public', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const form = await prisma.form.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        fields: true,
        utmTracking: true,
        redirectUrl: true,
        styling: true,
      },
    })

    if (!form) {
      return reply.status(404).send({ error: 'Form not found or inactive' })
    }

    return reply.send(form)
  })

  // POST /forms/:slug/submit — PUBLIC (no auth)
  app.post('/forms/:slug/submit', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const form = await prisma.form.findFirst({
      where: { slug, isActive: true },
    })

    if (!form) {
      return reply.status(404).send({ error: 'Form not found or inactive' })
    }

    const body = request.body as Record<string, unknown>
    const {
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      ...formData
    } = body as {
      utm_source?: string
      utm_medium?: string
      utm_campaign?: string
      utm_content?: string
      utm_term?: string
      [key: string]: unknown
    }

    // Extract contact fields from form data
    const name = formData.name as string | undefined
    const email = formData.email as string | undefined
    const phone = formData.phone as string | undefined

    if (!name) {
      return reply.status(400).send({ error: 'name field is required' })
    }

    // Normalize phone: keep only digits
    const normalizedPhone = phone
      ? phone.toString().replace(/\D/g, '')
      : undefined

    // Upsert contact
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: form.tenantId,
        ...(email ? { email } : normalizedPhone ? { phone: normalizedPhone } : { name }),
      },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: form.tenantId,
          name,
          email: email ?? null,
          phone: normalizedPhone ?? null,
        },
      })
    } else {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          ...(name && { name }),
          ...(email && { email }),
          ...(normalizedPhone && { phone: normalizedPhone }),
        },
      })
    }

    // Create Opportunity if pipeline configured
    let opportunityId: string | undefined

    if (form.pipelineId && form.initialStageId) {
      const pipeline = await prisma.pipeline.findUnique({
        where: { id: form.pipelineId },
      })

      const assignedToId = form.autoAssignToId
        ?? (await prisma.user.findFirst({
          where: { tenantId: form.tenantId, role: 'ADMIN', isActive: true },
          select: { id: true },
        }))?.id

      if (pipeline && assignedToId) {
        const opportunity = await prisma.opportunity.create({
          data: {
            tenantId: form.tenantId,
            contactId: contact.id,
            pipelineId: form.pipelineId,
            stageId: form.initialStageId,
            assignedToId,
            title: `${name} — ${form.name}`,
            status: 'OPEN',
          },
        })
        opportunityId = opportunity.id
      }
    }

    // Create FormSubmission
    const submission = await prisma.formSubmission.create({
      data: {
        formId: form.id,
        data: formData as any,
        utmSource: utm_source ?? null,
        utmMedium: utm_medium ?? null,
        utmCampaign: utm_campaign ?? null,
        utmContent: utm_content ?? null,
        utmTerm: utm_term ?? null,
        ipAddress: request.ip ?? null,
        userAgent: request.headers['user-agent'] ?? null,
        referrerUrl: (request.headers['referer'] ?? request.headers['referrer'] ?? null) as string | null,
        opportunityId: opportunityId ?? null,
      },
    })

    return reply.status(201).send({
      success: true,
      submissionId: submission.id,
      redirectUrl: form.redirectUrl ?? null,
    })
  })

  // GET /forms/:id/submissions (auth)
  app.get('/forms/:id/submissions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    const { page = 1, limit = 50 } = request.query as any

    await prisma.form.findFirstOrThrow({ where: { id, tenantId } })

    const submissions = await prisma.formSubmission.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })

    const total = await prisma.formSubmission.count({ where: { formId: id } })

    return reply.send({ submissions, total })
  })
}
