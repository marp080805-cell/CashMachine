'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'

export function useDashboardRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }

    socket.on('opportunity:moved', invalidate)
    socket.on('opportunity:created', invalidate)
    socket.on('task:completed', invalidate)

    return () => {
      socket.off('opportunity:moved', invalidate)
      socket.off('opportunity:created', invalidate)
      socket.off('task:completed', invalidate)
    }
  }, [queryClient])
}
