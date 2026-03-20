'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { UserPlus, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { getInitials, formatDate } from '@/lib/utils'
import type { User } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  GESTOR: 'Gestor',
  SDR: 'SDR',
  CLOSER: 'Closer',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  GESTOR: 'bg-blue-100 text-blue-700',
  SDR: 'bg-green-100 text-green-700',
  CLOSER: 'bg-amber-100 text-amber-700',
}

const inviteSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['ADMIN', 'GESTOR', 'SDR', 'CLOSER']),
})
type InviteForm = z.infer<typeof inviteSchema>

export default function UsuariosPage() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: User[] }>('/users'),
  })

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'SDR' },
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => api.post('/auth/invite', data),
    onSuccess: () => {
      toast.success('Convite enviado com sucesso!')
      setInviteOpen(false)
      reset()
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Erro ao enviar convite'),
  })

  const users = data?.users ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left">Perfil</th>
                <th className="px-4 py-3 text-left">Desde</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={ROLE_COLORS[user.role] ?? ''}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">Ativo</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => inviteMutation.mutate(data))} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" {...register('name')} className="mt-1" placeholder="João Silva" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register('email')} className="mt-1" placeholder="joao@empresa.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Perfil</Label>
              <Select defaultValue="SDR" onValueChange={(v) => setValue('role', v as InviteForm['role'])}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Enviar Convite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
