'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, Radio, MessageSquare, LayoutDashboard, Target, SlidersHorizontal } from 'lucide-react'

const tabs = [
  { href: '/configuracoes/usuarios', label: 'Usuários', icon: Users },
  { href: '/configuracoes/canais', label: 'Canais', icon: Radio },
  { href: '/configuracoes/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { href: '/configuracoes/campos-leads', label: 'Campos de Leads', icon: SlidersHorizontal },
  { href: '/configuracoes/metas', label: 'Metas', icon: Target },
  { href: '/configuracoes/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
