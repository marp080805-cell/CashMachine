'use client'

import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { api } from '@/lib/api'
import { disconnectSocket } from '@/lib/socket'

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore()
  const router = useRouter()

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false
      if (user.permissions.includes('*')) return true
      return user.permissions.includes(permission)
    },
    [user]
  )

  const logout = useCallback(async () => {
    const refreshToken = useAuthStore.getState().refreshToken
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken })
      } catch {
        // ignore
      }
    }
    disconnectSocket()
    clearAuth()
    router.push('/login')
  }, [clearAuth, router])

  return {
    user,
    token,
    isAuthenticated,
    hasPermission,
    setAuth,
    logout,
  }
}
