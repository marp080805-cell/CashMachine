'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TranscricoesPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/gravacoes') }, [router])
  return null
}
