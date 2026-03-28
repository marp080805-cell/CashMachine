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
import lostReasonsRoutes from './modules/lost-reasons/lost-reasons.routes'

// Supporting
import activitiesRoutes from './modules/activities/activities.routes'
import tasksRoutes from './modules/tasks/tasks.routes'
import taskTemplatesRoutes from './modules/tasks/task-templates.routes'
import dashboardRoutes from './modules/dashboard/dashboard.routes'
import analyticsRoutes from './modules/dashboard/analytics.routes'
import reportsRoutes from './modules/reports/reports.routes'
import notificationsRoutes from './modules/notifications/notifications.routes'

// New modules
import goalsRoutes from './modules/goals/goals.routes'
import meetingsRoutes from './modules/meetings/meetings.routes'
import conversationsRoutes from './modules/conversations/conversations.routes'
import aiAgentsRoutes from './modules/ai-agents/ai-agents.routes'
import stageTriggerRoutes from './modules/stage-triggers/stage-triggers.routes'
import salebotsRoutes from './modules/salesbots/salesbots.routes'
import recordingsRoutes from './modules/recordings/recordings.routes'
import formsRoutes from './modules/forms/forms.routes'
import accountTemplatesRoutes from './modules/account-templates/account-templates.routes'
import fieldConfigRoutes from './modules/settings/field-config.routes'

// WhatsApp + AI (maintained)
import whatsappRoutes from './modules/whatsapp/whatsapp.routes'
import aiRoutes from './modules/ai/ai.routes'

// Queues
import { startAiSuggestionWorker } from './queues/ai-suggestion.queue'
import { startNotificationWorker } from './queues/notification.queue'
import { startEmailWorker } from './queues/email.queue'
import { startTranscriptionWorker } from './queues/transcription.queue'
import { startStageTriggerWorker } from './queues/trigger.queue'
import { startBotExecutionWorker } from './queues/bot-execution.queue'
import { startRecordingAnalysisWorker } from './queues/recording-analysis.queue'
import { startDailyMetricsWorker } from './queues/daily-metrics.queue'

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
  await app.register(lostReasonsRoutes)
  await app.register(activitiesRoutes)
  await app.register(tasksRoutes)
  await app.register(taskTemplatesRoutes)
  await app.register(dashboardRoutes)
  await app.register(analyticsRoutes)
  await app.register(reportsRoutes)
  await app.register(notificationsRoutes)
  await app.register(goalsRoutes)
  await app.register(meetingsRoutes)
  await app.register(conversationsRoutes)
  await app.register(aiAgentsRoutes)
  await app.register(stageTriggerRoutes)
  await app.register(salebotsRoutes)
  await app.register(recordingsRoutes)
  await app.register(formsRoutes)
  await app.register(accountTemplatesRoutes)
  await app.register(fieldConfigRoutes)
  await app.register(whatsappRoutes)
  await app.register(aiRoutes)

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  const workers: import('bullmq').Worker[] = []

  if (env.OPENAI_API_KEY) {
    workers.push(startAiSuggestionWorker(app.io))
    workers.push(startTranscriptionWorker())
  }

  workers.push(startNotificationWorker())
  workers.push(startEmailWorker())
  workers.push(startStageTriggerWorker())
  workers.push(startBotExecutionWorker())
  workers.push(startRecordingAnalysisWorker())
  workers.push(startDailyMetricsWorker())

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[shutdown] Received ${signal}, closing workers and server...`)
    await Promise.all(workers.map((w) => w.close()))
    await app.close()
    await prisma.$disconnect()
    console.log('[shutdown] Done.')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

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
