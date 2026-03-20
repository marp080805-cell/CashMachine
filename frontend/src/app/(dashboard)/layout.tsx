'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { MobileNav } from '@/components/layout/MobileNav'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/funis': 'Funis CRM',
  '/whatsapp': 'WhatsApp',
  '/leads': 'Leads',
  '/planejamento': 'Planejamento de Canais',
  '/tarefas': 'Tarefas',
  '/relatorios': 'Relatórios',
  '/performance': 'Performance do Time',
  '/transcricoes': 'Transcrições & IA',
  '/configuracoes': 'Configurações',
  '/configuracoes/usuarios': 'Usuários',
  '/configuracoes/canais': 'Canais',
  '/configuracoes/whatsapp': 'WhatsApp — Números',
  '/configuracoes/campos-leads': 'Campos de Leads',
  '/configuracoes/metas': 'Metas',
  '/configuracoes/dashboard': 'Configurar Dashboard',
}

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith('/funis/')) return 'Kanban do Funil'
  if (pathname.startsWith('/leads/')) return 'Detalhes do Lead'
  return 'CashMind'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const router = useRouter()
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar
          title={getTitle(pathname)}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
