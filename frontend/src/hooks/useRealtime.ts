'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export function useDashboardRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('dashboard:updates')
      .on('broadcast', { event: 'lead:created' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .on('broadcast', { event: 'deal:moved' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .on('broadcast', { event: 'task:completed' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}
