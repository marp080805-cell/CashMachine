import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requirePermission } from '../../middleware/rbac'

// Flatten the origin tree into a list with full path computed
function flattenOrigins(
  origins: Array<{ id: string; name: string; parentId: string | null; children?: any[]; isActive: boolean; tenantId: string; createdAt: Date }>,
  parent: { id: string; path: string } | null = null,
  depth = 0
): Array<{ id: string; name: string; path: string; depth: number; parentId: string | null }> {
  const result: Array<{ id: string; name: string; path: string; depth: number; parentId: string | null }> = []
  for (const origin of origins) {
    const path = parent ? `${parent.path} > ${origin.name}` : origin.name
    result.push({ id: origin.id, name: origin.name, path, depth, parentId: origin.parentId })
    if (origin.children && origin.children.length > 0) {
      result.push(...flattenOrigins(origin.children, { id: origin.id, path }, depth + 1))
    }
  }
  return result
}

// Build nested tree from DB result (roots only, children populated recursively via include)
async function getOriginTree(tenantId: string) {
  const roots = await prisma.origin.findMany({
    where: { tenantId, isActive: true, parentId: null },
    orderBy: { name: 'asc' },
    include: buildInclude(5),
  })
  return roots
}

function buildInclude(depth: number): any {
  if (depth === 0) return undefined
  return { children: { where: { isActive: true }, orderBy: { name: 'asc' as const }, include: buildInclude(depth - 1) } }
}

// Get full ancestor path IDs for a given originId
async function getAncestorIds(originId: string): Promise<string[]> {
  const ids: string[] = []
  let currentId: string | null = originId
  const visited = new Set<string>()
  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const origin = await prisma.origin.findUnique({ where: { id: currentId }, select: { id: true, parentId: true } })
    if (!origin) break
    ids.unshift(origin.id)
    currentId = origin.parentId
  }
  return ids
}

export default async function originsRoutes(app: FastifyInstance) {
  // Listar origens — retorna flat list com path completo
  app.get('/origins', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const { flat } = z.object({ flat: z.coerce.boolean().default(false) }).parse(request.query)

    const tree = await getOriginTree(tenantId)

    if (flat) {
      return reply.send(flattenOrigins(tree))
    }
    return reply.send(tree)
  })

  // Retorna flat list com paths (atalho usado no frontend)
  app.get('/origins/flat', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const tree = await getOriginTree(tenantId)
    return reply.send(flattenOrigins(tree))
  })

  // Retorna os IDs dos ancestrais de um origin (para auto-popular breadcrumb)
  app.get('/origins/:id/ancestors', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tenantId } = request.user as { tenantId: string }
    await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
    const ancestorIds = await getAncestorIds(id)
    return reply.send({ ids: ancestorIds })
  })

  app.post(
    '/origins',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({
        name: z.string().min(1),
        parentId: z.string().uuid().optional(),
      }).parse(request.body)

      // Validate parent belongs to same tenant
      if (input.parentId) {
        await prisma.origin.findFirstOrThrow({ where: { id: input.parentId, tenantId } })
      }

      const origin = await prisma.origin.create({ data: { ...input, tenantId } })
      return reply.status(201).send(origin)
    }
  )

  app.patch(
    '/origins/:id',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({
        name: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
        parentId: z.string().uuid().nullable().optional(),
      }).parse(request.body)

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      const origin = await prisma.origin.update({ where: { id }, data: input })
      return reply.send(origin)
    }
  )

  app.delete(
    '/origins/:id',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.origin.update({ where: { id }, data: { isActive: false } })
      return reply.send({ success: true })
    }
  )

  // Sub-origens (legacy — mantido para compatibilidade)
  app.post(
    '/origins/:id/sub-origins',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().min(1) }).parse(request.body)

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      const subOrigin = await prisma.subOrigin.create({ data: { ...input, originId: id } })
      return reply.status(201).send(subOrigin)
    }
  )

  app.patch(
    '/origins/:id/sub-origins/:subId',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id, subId } = request.params as { id: string; subId: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() }).parse(request.body)

      await prisma.origin.findFirstOrThrow({ where: { id, tenantId } })
      await prisma.subOrigin.findFirstOrThrow({ where: { id: subId, originId: id } })
      const subOrigin = await prisma.subOrigin.update({ where: { id: subId }, data: input })
      return reply.send(subOrigin)
    }
  )

  // Motivos de perda
  app.get('/lost-reasons', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string }
    const reasons = await prisma.lostReason.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    })
    return reply.send(reasons)
  })

  app.post(
    '/lost-reasons',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string }
      const { name } = z.object({ name: z.string().min(1) }).parse(request.body)
      const reason = await prisma.lostReason.create({ data: { name, tenantId } })
      return reply.status(201).send(reason)
    }
  )

  app.patch(
    '/lost-reasons/:id',
    { preHandler: [app.authenticate, requirePermission('origins:manage')] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { tenantId } = request.user as { tenantId: string }
      const input = z.object({ name: z.string().optional(), isActive: z.boolean().optional() }).parse(request.body)

      await prisma.lostReason.findFirstOrThrow({ where: { id, tenantId } })
      const reason = await prisma.lostReason.update({ where: { id }, data: input })
      return reply.send(reason)
    }
  )
}
