'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WhatsappRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes/integracoes')
  }, [router])
  return null
}
