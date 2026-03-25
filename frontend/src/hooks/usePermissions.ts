'use client'

import { useAuthStore } from '@/stores/authStore'

export function usePermissions() {
  const user = useAuthStore((state) => state.user)

  function can(permission: string): boolean {
    if (!user) return false
    if (user.permissions.includes('*')) return true
    return user.permissions.includes(permission)
  }

  function isAdmin(): boolean {
    return user?.role === 'ADMIN'
  }

  function isAdminOrGestor(): boolean {
    return user?.role === 'ADMIN' || user?.role === 'MANAGER'
  }

  return { can, isAdmin, isAdminOrGestor, role: user?.role }
}
