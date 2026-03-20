'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#176968] via-[#0f4e4d] to-[#0A1E1D] dark:from-[#0D0D0D] dark:via-[#0A1A19] dark:to-[#000000] flex items-center justify-center p-4">
      {children}
    </div>
  )
}
