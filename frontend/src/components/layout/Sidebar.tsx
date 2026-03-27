'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  GitBranch,
  MessageSquare,
  Users,
  BarChart2,
  FileText,
  Mic,
  Settings,
  LogOut,
  Brain,
  Building2,
  UserCheck,
  TrendingUp,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { href: '/funis', label: 'Funis', icon: GitBranch, permission: 'pipelines:view' },
  { href: '/contatos', label: 'Contatos', icon: Users, permission: 'contacts:view' },
  { href: '/empresas', label: 'Empresas', icon: Building2, permission: 'contacts:view' },
  { href: '/leads', label: 'Leads', icon: UserCheck, permission: 'leads:view' },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, permission: 'whatsapp:view_own' },
  { href: '/tarefas', label: 'Tarefas', icon: FileText, permission: 'tasks:view_own' },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2, permission: 'reports:view' },
  { href: '/performance', label: 'Performance', icon: TrendingUp, permission: 'performance:view' },
  { href: '/transcricoes', label: 'Transcrições', icon: Mic, permission: 'transcriptions:view_own' },
]

interface SidebarProps {
  className?: string
  onClose?: () => void
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { can } = usePermissions()

  return (
    <aside
      className={cn(
        'flex h-full w-60 flex-col bg-sidebar-bg text-sidebar-text',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 flex-shrink-0">
            <Brain className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="flex flex-col justify-center leading-none">
            <span className="font-bold text-[15px] text-white tracking-tight">CashMind</span>
            <div className="flex items-center gap-1 mt-[3px]">
              <span className="text-sidebar-text/50 text-[10px]">by</span>
              <Image
                src="/logo-branco.png"
                alt="Logo"
                width={60}
                height={12}
                className="h-[11px] w-auto object-contain opacity-60"
                priority
              />
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-3">
          {navItems.map((item) => {
            if (!can(item.permission)) return null

            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-white/15 text-sidebar-active border-l-2 border-sidebar-active pl-[10px]'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-active'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Settings section */}
        <div className="mt-4 px-3">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-text/50">
            Sistema
          </p>
          {can('*') && (
            <Link
              href="/configuracoes"
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150',
                pathname.startsWith('/configuracoes')
                  ? 'bg-white/15 text-sidebar-active border-l-2 border-sidebar-active pl-[10px]'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-active'
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Configurações
            </Link>
          )}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8 ring-2 ring-sidebar-active/30">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs bg-sidebar-hover text-sidebar-active">
              {user?.name ? getInitials(user.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-active truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-text/60 truncate">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-text/70 hover:text-sidebar-active hover:bg-sidebar-hover"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
