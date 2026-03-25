import type { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole } from '@prisma/client'

export const PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ['*'],
  MANAGER: [
    'dashboard:view', 'dashboard:view_team',
    'pipelines:view', 'pipelines:manage',
    'contacts:view', 'contacts:edit',
    'companies:view', 'companies:edit',
    'leads:view', 'leads:edit',
    'opportunities:view', 'opportunities:view_all', 'opportunities:edit',
    'reports:view', 'reports:view_all',
    'origins:view', 'origins:manage',
    'tags:view', 'tags:manage',
    'custom-fields:view', 'custom-fields:manage',
    'tasks:view', 'tasks:view_team',
    'users:view', 'users:invite',
    'whatsapp:view_all',
    'activities:create',
  ],
  SDR: [
    'dashboard:view',
    'pipelines:view',
    'contacts:view', 'contacts:create', 'contacts:edit_own',
    'companies:view',
    'leads:view', 'leads:create', 'leads:edit_own',
    'opportunities:view_own', 'opportunities:create', 'opportunities:edit_own',
    'tags:view',
    'custom-fields:view',
    'tasks:view_own', 'tasks:create', 'tasks:complete',
    'whatsapp:view_own', 'whatsapp:send',
    'activities:create',
  ],
  CLOSER: [
    'dashboard:view',
    'pipelines:view',
    'contacts:view', 'contacts:edit_own',
    'companies:view',
    'leads:view',
    'opportunities:view_own', 'opportunities:edit_own', 'opportunities:won', 'opportunities:lost',
    'tags:view',
    'custom-fields:view',
    'tasks:view_own', 'tasks:create', 'tasks:complete',
    'whatsapp:view_own', 'whatsapp:send',
    'activities:create',
    'reports:view_own',
  ],
  VIEWER: [
    'dashboard:view',
    'pipelines:view',
    'contacts:view',
    'companies:view',
    'leads:view',
    'opportunities:view_all',
    'reports:view',
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
