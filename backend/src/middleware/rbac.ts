import type { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole } from '@prisma/client'

export const PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ['*'],
  GESTOR: [
    'dashboard:view', 'dashboard:view_team',
    'funnels:view', 'funnels:view_all',
    'leads:view', 'leads:view_all', 'leads:edit',
    'deals:view', 'deals:view_all', 'deals:edit',
    'reports:view', 'reports:view_all',
    'performance:view', 'performance:view_team',
    'whatsapp:view_all',
    'tasks:view', 'tasks:view_team',
    'channels:view', 'planning:view',
    'activities:create',
  ],
  SDR: [
    'dashboard:view',
    'funnels:view', 'funnels:edit_own',
    'leads:view', 'leads:create', 'leads:edit_own',
    'deals:view_own', 'deals:create', 'deals:edit_own',
    'whatsapp:view_own', 'whatsapp:send',
    'tasks:view_own', 'tasks:create', 'tasks:complete',
    'activities:create',
    'planning:view',
    'transcriptions:view_own', 'transcriptions:create',
  ],
  CLOSER: [
    'dashboard:view',
    'funnels:view', 'funnels:edit_own',
    'leads:view', 'leads:edit_own',
    'deals:view_own', 'deals:edit_own', 'deals:won', 'deals:lost',
    'tasks:view_own', 'tasks:create', 'tasks:complete',
    'activities:create',
    'transcriptions:view_own', 'transcriptions:create',
    'reports:view_own',
  ],
}

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

export function requirePermission(permission: string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { id: string; role: UserRole }
    if (!user || !hasPermission(user.role, permission)) {
      reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
