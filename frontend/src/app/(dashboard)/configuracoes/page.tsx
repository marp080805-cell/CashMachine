'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfiguracoesPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes/usuarios')
  }, [router])
  return null
}
