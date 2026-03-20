'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead } from '@/types'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Upload } from 'lucide-react'
import { formatDate, formatPhone } from '@/lib/utils'
import Link from 'next/link'

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  QUALIFIED: 'Qualificado',
  UNQUALIFIED: 'Desqualificado',
  CUSTOMER: 'Cliente',
  LOST: 'Perdido',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  NEW: 'default',
  CONTACTED: 'secondary',
  QUALIFIED: 'success',
  UNQUALIFIED: 'danger',
  CUSTOMER: 'success',
  LOST: 'danger',
}

export default function LeadsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search],
    queryFn: () =>
      api.get<{ leads: Lead[]; pagination: { page: number; pages: number; total: number; limit: number } }>(
        `/leads?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ),
  })

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row: Lead) => (
        <Link href={`/leads/${row.id}`} className="font-medium text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'company',
      header: 'Empresa',
      render: (row: Lead) => <span className="text-sm">{row.company?.name ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (row: Lead) => (
        <span className="text-sm text-muted-foreground">
          {row.phone ? formatPhone(row.phone) : '—'}
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Canal',
      render: (row: Lead) => (
        <span className="text-sm">{row.channel?.name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Lead) => (
        <Badge variant={statusVariants[row.status] ?? 'secondary'}>
          {statusLabels[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (row: Lead) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.leads ?? []}
        isLoading={isLoading}
        rowKey={(row) => row.id}
        pagination={data?.pagination ? {
          page: data.pagination.page,
          pages: data.pagination.pages,
          total: data.pagination.total,
          onPageChange: setPage,
        } : undefined}
        emptyMessage="Nenhum lead encontrado"
      />
    </div>
  )
}
