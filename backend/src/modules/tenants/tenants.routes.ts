import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'
import { encryptIfNeeded } from '../../lib/encryption'

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['FREE', 'STANDARD', 'PRO', 'ENTERPRISE']).optional(),
})

const setupTenantSchema = z.object({
  tenantName: z.string().min(1),
  tenantSlug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
})

export default async function tenantsRoutes(app: FastifyInstance) {
  // Setup inicial: criar tenant + admin de uma vez (rota pública, só funciona se tenant não existe)
  app.post('/tenants/setup', async (request, reply) => {
    const input = setupTenantSchema.parse(request.body)

    const existing = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } })
    if (existing) {
      return reply.status(409).send({ error: 'Tenant já existe' })
    }

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.default.hash(input.adminPassword, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: input.tenantName,
        slug: input.tenantSlug,
        users: {
          create: {
            name: input.adminName,
            email: input.adminEmail,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
          },
        },
      },
      include: {
        users: { select: { id: true, email: true, name: true, role: true } },
      },
    })

    return reply.status(201).send({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: tenant.users[0],
    })
  })

  // Listar tenants (só super admin — sem tenant scoping aqui)
  app.get(
    '/tenants',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as { role: string }
      if (user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      const tenants = await prisma.tenant.findMany({
        select: { id: true, name: true, slug: true, plan: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(tenants)
    }
  )

  // Info do tenant atual — GET /tenants/current e alias GET /tenants/me
  async function getTenantMe(request: { user: { tenantId: string } }, reply: Parameters<Parameters<typeof app.get>[2]>[1]) {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: request.user.tenantId },
      select: { id: true, name: true, slug: true, plan: true, settings: true, openaiApiKey: true, openaiModel: true },
    })
    const settings = (tenant.settings ?? {}) as Record<string, unknown>
    return reply.send({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      settings: tenant.settings,
      // Expõe apenas se está configurado (não expõe o valor real)
      openaiApiKey: tenant.openaiApiKey ? true : null,
      openaiModel: tenant.openaiModel ?? 'gpt-4o',
      resendApiKey: settings.resendApiKey ? true : null,
    })
  }

  app.get('/tenants/current', { preHandler: [app.authenticate] }, async (req, reply) => {
    return getTenantMe(req as { user: { tenantId: string } }, reply)
  })
  app.get('/tenants/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    return getTenantMe(req as { user: { tenantId: string } }, reply)
  })

  // Atualizar tenant — PATCH /tenants/current e alias /tenants/me
  const patchTenantSchema = z.object({
    name: z.string().min(1).optional(),
    openaiApiKey: z.string().min(1).optional(),
    openaiModel: z.string().optional(),
    resendApiKey: z.string().min(1).optional(),
    settings: z.record(z.unknown()).optional(),
  })

  async function patchTenantMe(request: { user: { tenantId: string }; body: unknown }, reply: Parameters<Parameters<typeof app.patch>[2]>[1]) {
    const { tenantId } = request.user
    const { name, openaiApiKey, openaiModel, resendApiKey, settings } = patchTenantSchema.parse(request.body)

    // Build top-level update
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (openaiApiKey !== undefined) data.openaiApiKey = encryptIfNeeded(openaiApiKey)
    if (openaiModel !== undefined) data.openaiModel = openaiModel

    // Merge settings
    if (settings !== undefined || resendApiKey !== undefined) {
      const existing = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { settings: true },
      })
      const merged = { ...((existing.settings ?? {}) as Record<string, unknown>), ...settings }
      if (resendApiKey !== undefined) merged.resendApiKey = resendApiKey
      data.settings = merged as Prisma.InputJsonValue
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: data as Parameters<typeof prisma.tenant.update>[0]['data'],
      select: { id: true, name: true, slug: true, plan: true, settings: true, openaiApiKey: true, openaiModel: true },
    })
    const updatedSettings = (tenant.settings ?? {}) as Record<string, unknown>
    return reply.send({
      id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan,
      openaiApiKey: tenant.openaiApiKey ? true : null,
      openaiModel: tenant.openaiModel ?? 'gpt-4o',
      resendApiKey: updatedSettings.resendApiKey ? true : null,
    })
  }

  app.patch('/tenants/current', { preHandler: [app.authenticate, requirePermission('admin:tenant')] }, async (req, reply) => {
    return patchTenantMe(req as { user: { tenantId: string }; body: unknown }, reply)
  })
  app.patch('/tenants/me', { preHandler: [app.authenticate, requirePermission('admin:tenant')] }, async (req, reply) => {
    return patchTenantMe(req as { user: { tenantId: string }; body: unknown }, reply)
  })

  // Merge-patch tenant settings (mantém compatibilidade)
  app.patch(
    '/tenants/current/settings',
    { preHandler: [app.authenticate, requirePermission('admin:tenant')] },
    async (request, reply) => {
      const user = request.user as { tenantId: string }
      const patch = z.record(z.unknown()).parse(request.body)
      const existing = await prisma.tenant.findUniqueOrThrow({
        where: { id: user.tenantId },
        select: { settings: true },
      })
      const merged = { ...((existing.settings ?? {}) as Record<string, unknown>), ...patch }
      const tenant = await prisma.tenant.update({
        where: { id: user.tenantId },
        data: { settings: merged as Prisma.InputJsonValue },
        select: { id: true, name: true, slug: true, plan: true, settings: true },
      })
      return reply.send(tenant)
    }
  )
}
