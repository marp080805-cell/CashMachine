import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'
import { encryptIfNeeded } from '../../lib/encryption'

const setupTenantSchema = z.object({
  tenantName: z.string().min(1),
  tenantSlug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
})

const patchTenantSchema = z.object({
  name: z.string().min(1).optional(),
  openaiApiKey: z.string().min(1).optional(),
  openaiModel: z.string().optional(),
  anthropicApiKey: z.string().min(1).optional(),
  resendApiKey: z.string().min(1).optional(),
  settings: z.record(z.unknown()).optional(),
})

async function buildTenantResponse(tenantId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, plan: true, settings: true, openaiApiKey: true, openaiModel: true },
  })
  const settings = (tenant.settings ?? {}) as Record<string, unknown>
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    settings: tenant.settings,
    openaiApiKey: tenant.openaiApiKey ? true : null,
    openaiModel: tenant.openaiModel ?? 'gpt-4o',
    anthropicApiKey: settings.anthropicApiKey ? true : null,
    resendApiKey: settings.resendApiKey ? true : null,
  }
}

export default async function tenantsRoutes(app: FastifyInstance) {
  // Setup inicial: criar tenant + admin de uma vez (rota pública)
  app.post('/tenants/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = setupTenantSchema.parse(request.body)
    const existing = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } })
    if (existing) return reply.status(409).send({ error: 'Tenant já existe' })

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.default.hash(input.adminPassword, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: input.tenantName,
        slug: input.tenantSlug,
        users: {
          create: { name: input.adminName, email: input.adminEmail, passwordHash, role: 'ADMIN', isActive: true },
        },
      },
      include: { users: { select: { id: true, email: true, name: true, role: true } } },
    })

    return reply.status(201).send({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: tenant.users[0],
    })
  })

  // Listar tenants (só super admin)
  app.get('/tenants', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role: string }
    if (user.role !== 'ADMIN') return reply.status(403).send({ error: 'Forbidden' })
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, plan: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(tenants)
  })

  // GET tenant atual — /tenants/current e /tenants/me
  app.get('/tenants/current', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user as { tenantId: string }
    return reply.send(await buildTenantResponse(tenantId))
  })

  app.get('/tenants/me', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user as { tenantId: string }
    return reply.send(await buildTenantResponse(tenantId))
  })

  // PATCH tenant — /tenants/current e /tenants/me
  async function handlePatch(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.user as { tenantId: string }
    const { name, openaiApiKey, openaiModel, anthropicApiKey, resendApiKey, settings } = patchTenantSchema.parse(request.body)

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (openaiApiKey !== undefined) data.openaiApiKey = encryptIfNeeded(openaiApiKey)
    if (openaiModel !== undefined) data.openaiModel = openaiModel

    if (settings !== undefined || resendApiKey !== undefined || anthropicApiKey !== undefined) {
      const existing = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { settings: true } })
      const merged = { ...((existing.settings ?? {}) as Record<string, unknown>), ...(settings ?? {}) }
      if (resendApiKey !== undefined) merged.resendApiKey = resendApiKey
      if (anthropicApiKey !== undefined) merged.anthropicApiKey = encryptIfNeeded(anthropicApiKey)
      data.settings = merged as Prisma.InputJsonValue
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: data as Prisma.TenantUpdateInput,
    })

    return reply.send(await buildTenantResponse(tenantId))
  }

  app.patch('/tenants/current', { preHandler: [app.authenticate, requirePermission('admin:tenant')] }, handlePatch)
  app.patch('/tenants/me', { preHandler: [app.authenticate, requirePermission('admin:tenant')] }, handlePatch)

  // Merge-patch settings (compatibilidade)
  app.patch('/tenants/current/settings', { preHandler: [app.authenticate, requirePermission('admin:tenant')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user as { tenantId: string }
    const patch = z.record(z.unknown()).parse(request.body)
    const existing = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { settings: true } })
    const merged = { ...((existing.settings ?? {}) as Record<string, unknown>), ...patch }
    await prisma.tenant.update({ where: { id: tenantId }, data: { settings: merged as Prisma.InputJsonValue } })
    return reply.send(await buildTenantResponse(tenantId))
  })
}
