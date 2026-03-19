'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  GitBranch,
  MessageSquare,
  Users,
  BarChart2,
  Calendar,
  FileText,
  TrendingUp,
  Mic,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { href: '/funis', label: 'Funis CRM', icon: GitBranch, permission: 'funnels:view' },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, permission: 'whatsapp:view_own' },
  { href: '/leads', label: 'Leads', icon: Users, permission: 'leads:view' },
  { href: '/planejamento', label: 'Planejamento', icon: Calendar, permission: 'planning:view' },
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
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-1 text-xl font-bold">
          <span className="text-white">Cash</span>
          <span className="text-primary">Machine</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
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
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                      : 'hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 px-3">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sistema
          </p>
          {can('*') && (
            <Link
              href="/configuracoes"
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                pathname.startsWith('/configuracoes')
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                  : 'hover:bg-slate-800 hover:text-white'
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Configurações
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">{user?.name ? getInitials(user.name) : 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
