import './config/env'
import Fastify from 'fastify'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import bcrypt from 'bcryptjs'

import multipart from '@fastify/multipart'
import authPlugin from './plugins/auth'
import corsPlugin from './plugins/cors'
import socketPlugin from './plugins/socket'

import authRoutes from './modules/auth/auth.routes'
import usersRoutes from './modules/users/users.routes'
import leadsRoutes from './modules/leads/leads.routes'
import companiesRoutes from './modules/companies/companies.routes'
import funnelsRoutes from './modules/funnels/funnels.routes'
import dealsRoutes from './modules/deals/deals.routes'
import activitiesRoutes from './modules/activities/activities.routes'
import tasksRoutes from './modules/tasks/tasks.routes'
import channelsRoutes from './modules/channels/channels.routes'
import whatsappRoutes from './modules/whatsapp/whatsapp.routes'
import aiRoutes from './modules/ai/ai.routes'
import reportsRoutes from './modules/reports/reports.routes'
import dashboardRoutes from './modules/dashboard/dashboard.routes'
import notificationsRoutes from './modules/notifications/notifications.routes'

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

  await app.register(authRoutes)
  await app.register(usersRoutes)
  await app.register(leadsRoutes)
  await app.register(companiesRoutes)
  await app.register(funnelsRoutes)
  await app.register(dealsRoutes)
  await app.register(activitiesRoutes)
  await app.register(tasksRoutes)
  await app.register(channelsRoutes)
  await app.register(whatsappRoutes)
  await app.register(aiRoutes)
  await app.register(reportsRoutes)
  await app.register(dashboardRoutes)
  await app.register(notificationsRoutes)

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  if (env.OPENAI_API_KEY) {
    startAiSuggestionWorker(app.io)
    startTranscriptionWorker()
  }

  startNotificationWorker()
  startEmailWorker()

  // Create initial admin user from env if not exists
  const existing = await prisma.user.findUnique({ where: { email: env.ADMIN_EMAIL } })
  if (!existing) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10)
    await prisma.user.create({
      data: { email: env.ADMIN_EMAIL, name: env.ADMIN_NAME, passwordHash, role: 'ADMIN' },
    })
    console.log(`Admin user created: ${env.ADMIN_EMAIL}`)
  }

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
  console.log(`CashMachine API running on port ${env.API_PORT}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
