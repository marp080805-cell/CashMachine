import './config/env'
import Fastify from 'fastify'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import bcrypt from 'bcryptjs'

import multipart from '@fastify/multipart'
import authPlugin from './plugins/auth'
import corsPlugin from './plugins/cors'
import socketPlugin from './plugins/socket'

// Auth & Tenant
import authRoutes from './modules/auth/auth.routes'
import tenantsRoutes from './modules/tenants/tenants.routes'

// Core entities
import usersRoutes from './modules/users/users.routes'
import contactsRoutes from './modules/contacts/contacts.routes'
import companiesRoutes from './modules/companies/companies.routes'
import leadsRoutes from './modules/leads/leads.routes'
import opportunitiesRoutes from './modules/opportunities/opportunities.routes'
import pipelinesRoutes from './modules/pipelines/pipelines.routes'
import originsRoutes from './modules/origins/origins.routes'
import tagsRoutes from './modules/tags/tags.routes'
import customFieldsRoutes from './modules/custom-fields/custom-fields.routes'

// Supporting
import activitiesRoutes from './modules/activities/activities.routes'
import tasksRoutes from './modules/tasks/tasks.routes'
import dashboardRoutes from './modules/dashboard/dashboard.routes'
import reportsRoutes from './modules/reports/reports.routes'
import notificationsRoutes from './modules/notifications/notifications.routes'

// New modules
import goalsRoutes from './modules/goals/goals.routes'

// WhatsApp + AI (maintained)
import whatsappRoutes from './modules/whatsapp/whatsapp.routes'
import aiRoutes from './modules/ai/ai.routes'

// Queues
import { startAiSuggestionWorker } from './queues/ai-suggestion.queue'
import { startNotificationWorker } from './queues/notification.queue'
import { startEmailWorker } from './queues/email.queue'
import { startTranscriptionWorker } from './queues/transcription.queue'

const app = Fastify({
  logger: env.NODE_ENV === 'development',
})

async function bootstrap() {
  await app.register(corsPlugin)
  await app.register(authPlugin)
  await app.register(socketPlugin)
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })

  app.setErrorHandler((error, _request, reply) => {
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: JSON.parse(error.message) })
    }
    if (error.message?.includes('not found') || error.code === 'P2025') {
      return reply.status(404).send({ error: 'Not found' })
    }
    if (error.message === 'Invalid credentials') {
      return reply.status(401).send({ error: error.message })
    }
    if (error.message?.includes('already registered') || error.code === 'P2002') {
      return reply.status(409).send({ error: error.message })
    }

    app.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  })

  // Routes
  await app.register(authRoutes)
  await app.register(tenantsRoutes)
  await app.register(usersRoutes)
  await app.register(contactsRoutes)
  await app.register(companiesRoutes)
  await app.register(leadsRoutes)
  await app.register(opportunitiesRoutes)
  await app.register(pipelinesRoutes)
  await app.register(originsRoutes)
  await app.register(tagsRoutes)
  await app.register(customFieldsRoutes)
  await app.register(activitiesRoutes)
  await app.register(tasksRoutes)
  await app.register(dashboardRoutes)
  await app.register(reportsRoutes)
  await app.register(notificationsRoutes)
  await app.register(goalsRoutes)
  await app.register(whatsappRoutes)
  await app.register(aiRoutes)

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  if (env.OPENAI_API_KEY) {
    startAiSuggestionWorker(app.io)
    startTranscriptionWorker()
  }

  startNotificationWorker()
  startEmailWorker()

  // Bootstrap: criar tenant + admin se não existirem
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: env.ADMIN_TENANT_SLUG },
  })

  if (!existingTenant) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12)
    const tenant = await prisma.tenant.create({
      data: {
        name: env.ADMIN_TENANT_NAME,
        slug: env.ADMIN_TENANT_SLUG,
        users: {
          create: {
            email: env.ADMIN_EMAIL,
            name: env.ADMIN_NAME,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
          },
        },
      },
    })
    console.log(`Tenant criado: ${tenant.slug} | Admin: ${env.ADMIN_EMAIL}`)
  }

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
  console.log(`CashMind API running on port ${env.API_PORT}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
