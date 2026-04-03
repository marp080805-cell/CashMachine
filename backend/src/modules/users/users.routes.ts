import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'
import bcrypt from 'bcryptjs'

export default async function usersRoutes(app: FastifyInstance) {
  app.get('/users', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true, email: true, name: true, role: true,
        avatarUrl: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return reply.send({ users })
  })

  app.get('/users/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }

    const user = await prisma.user.findFirstOrThrow({
      where: { id, tenantId },
      select: {
        id: true, email: true, name: true, role: true,
        avatarUrl: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
    })

    return reply.send(user)
  })

  app.post(
    '/users',
    { preHandler: [app.authenticate, requirePermission('users:invite')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['ADMIN', 'MANAGER', 'SDR', 'CLOSER', 'VIEWER']).default('SDR'),
      }).parse(request.body)

      const existing = await prisma.user.findFirst({ where: { email: input.email, tenantId } })
      if (existing) return reply.status(409).send({ error: 'E-mail já cadastrado neste tenant' })

      const passwordHash = await bcrypt.hash(input.password, 12)
      const user = await prisma.user.create({
        data: { ...input, passwordHash, tenantId },
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, isActive: true, createdAt: true },
      })
      return reply.status(201).send(user)
    }
  )

  app.patch('/users/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId, id: currentUserId, role: currentRole } = request.user as {
      tenantId: string; id: string; role: string
    }

    const input = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      avatarUrl: z.string().url().optional(),
      role: z.enum(['ADMIN', 'MANAGER', 'SDR', 'CLOSER', 'VIEWER']).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8).optional(),
    }).parse(request.body)

    if (input.role !== undefined && currentRole !== 'ADMIN') {
      return reply.status(403).send({ error: 'Apenas admins podem alterar roles' })
    }

    if (currentUserId !== id && currentRole !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    await prisma.user.findFirstOrThrow({ where: { id, tenantId } })

    if (input.email) {
      const conflict = await prisma.user.findFirst({ where: { email: input.email, tenantId, NOT: { id } } })
      if (conflict) return reply.status(409).send({ error: 'E-mail já está em uso por outro usuário' })
    }

    const updateData: Record<string, unknown> = {}
    if (input.name) updateData.name = input.name
    if (input.email) updateData.email = input.email
    if (input.avatarUrl) updateData.avatarUrl = input.avatarUrl
    if (input.role) updateData.role = input.role
    if (input.isActive !== undefined) updateData.isActive = input.isActive
    if (input.password) updateData.passwordHash = await bcrypt.hash(input.password, 12)

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, isActive: true },
    })

    return reply.send(updated)
  })

  app.delete(
    '/users/:id',
    { preHandler: [app.authenticate, requirePermission('users:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId, id: currentUserId } = request.user as { tenantId: string; id: string }

      if (id === currentUserId) {
        return reply.status(400).send({ error: 'Não é possível desativar seu próprio usuário' })
      }

      await prisma.user.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.user.update({ where: { id }, data: { isActive: false } })
      return reply.send({ success: true })
    }
  )
}
