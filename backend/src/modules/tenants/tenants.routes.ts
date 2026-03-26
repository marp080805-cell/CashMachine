import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

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

  // Info do tenant atual
  app.get(
    '/tenants/current',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as { tenantId: string }
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: user.tenantId },
        select: { id: true, name: true, slug: true, plan: true, settings: true },
      })
      return reply.send(tenant)
    }
  )

  // Atualizar tenant
  app.patch(
    '/tenants/current',
    { preHandler: [app.authenticate, requirePermission('admin:tenant')] },
    async (request, reply) => {
      const user = request.user as { tenantId: string }
      const { settings, ...rest } = z.object({
        name: z.string().min(1).optional(),
        settings: z.record(z.unknown()).optional(),
      }).parse(request.body)

      const tenant = await prisma.tenant.update({
        where: { id: user.tenantId },
        data: { ...rest, ...(settings !== undefined && { settings: settings as Prisma.InputJsonValue }) },
        select: { id: true, name: true, slug: true, plan: true, settings: true },
      })
      return reply.send(tenant)
    }
  )
}
