'use client'

/**
 * EntityCombobox — combobox de busca + criação inline de entidade relacional
 *
 * Suporta: 'contact' | 'company' | 'opportunity'
 * Quando allowCreate=true e o texto digitado não bate com nenhum resultado,
 * exibe opção "Criar '[texto]'" que cria a entidade via API e retorna o id.
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Loader2, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType = 'contact' | 'company' | 'opportunity'

interface SearchResult {
  id: string
  label: string
  sublabel?: string
}

export interface EntityComboboxProps {
  entityType: EntityType
  value: string        // id da entidade selecionada ('' se nenhuma)
  label: string        // nome exibido ('' se nenhuma)
  onChange: (id: string, label: string) => void
  allowCreate?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

// ─── Search config por entityType ─────────────────────────────────────────────

function getSearchConfig(entityType: EntityType) {
  switch (entityType) {
    case 'contact':
      return {
        endpoint: (q: string) => `/contacts?search=${encodeURIComponent(q)}&limit=8`,
        mapResult: (item: Record<string, unknown>): SearchResult => ({
          id: item.id as string,
          label: item.name as string,
          sublabel: (item.email as string | null) ?? undefined,
        }),
        createEndpoint: '/contacts',
        createBody: (name: string) => ({ name }),
        entityLabel: 'contato',
      }
    case 'company':
      return {
        endpoint: (q: string) => `/companies?search=${encodeURIComponent(q)}&limit=8`,
        mapResult: (item: Record<string, unknown>): SearchResult => ({
          id: item.id as string,
          label: item.name as string,
          sublabel: (item.segment as string | null) ?? undefined,
        }),
        createEndpoint: '/companies',
        createBody: (name: string) => ({ name }),
        entityLabel: 'empresa',
      }
    case 'opportunity':
      return {
        endpoint: (q: string) => `/opportunities?search=${encodeURIComponent(q)}&limit=8`,
        mapResult: (item: Record<string, unknown>): SearchResult => ({
          id: item.id as string,
          label: item.title as string,
          sublabel: undefined,
        }),
        createEndpoint: null, // opportunities não são criadas inline
        createBody: null,
        entityLabel: 'oportunidade',
      }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EntityCombobox({
  entityType,
  value,
  label,
  onChange,
  allowCreate = false,
  placeholder,
  disabled = false,
  className,
}: EntityComboboxProps) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const config = getSearchConfig(entityType)

  const defaultPlaceholder = placeholder ?? `Buscar ${config.entityLabel}...`

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Search query
  const { data: rawResults, isFetching } = useQuery({
    queryKey: [entityType + '-combobox-search', q],
    queryFn: async () => {
      const res = await api.get<{ data?: unknown[]; [key: string]: unknown }>(config.endpoint(q))
      // Alguns endpoints retornam { data: [] }, outros retornam array direto
      const arr = Array.isArray(res) ? res : (res.data ?? [])
      return (arr as Record<string, unknown>[]).map(config.mapResult)
    },
    enabled: q.length > 0,
    staleTime: 10_000,
  })

  const results: SearchResult[] = rawResults ?? []

  // Inline create mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!config.createEndpoint || !config.createBody) throw new Error('create not supported')
      const res = await api.post<Record<string, unknown>>(config.createEndpoint, config.createBody(name))
      return { id: res.id as string, label: res.name as string }
    },
    onSuccess: ({ id, label: newLabel }) => {
      toast.success(`${config.entityLabel.charAt(0).toUpperCase() + config.entityLabel.slice(1)} criado!`)
      onChange(id, newLabel)
      setQ('')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: [entityType === 'contact' ? 'contacts' : 'companies'] })
    },
    onError: () => toast.error(`Erro ao criar ${config.entityLabel}`),
  })

  // Verifica se o texto digitado já existe exatamente nos resultados
  const exactMatch = results.some((r) => r.label.toLowerCase() === q.toLowerCase())
  const canCreate = allowCreate && config.createEndpoint && q.length > 1 && !exactMatch

  function handleSelect(result: SearchResult) {
    onChange(result.id, result.label)
    setQ('')
    setOpen(false)
  }

  function handleClear() {
    onChange('', '')
    setQ('')
  }

  function handleCreate() {
    createMutation.mutate(q)
  }

  // Se há valor selecionado, mostra chip com X
  if (value) {
    return (
      <div className={cn('flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-background', className)}>
        <span className="flex-1 font-medium truncate">{label}</span>
        {!disabled && (
          <button type="button" onClick={handleClear} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div className="relative">
        <Input
          placeholder={defaultPlaceholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => { if (q) setOpen(true) }}
          disabled={disabled || createMutation.isPending}
        />
        {(isFetching || createMutation.isPending) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (results.length > 0 || canCreate) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={() => handleSelect(r)}
            >
              <span className="font-medium">{r.label}</span>
              {r.sublabel && (
                <span className="text-muted-foreground ml-2 text-xs">{r.sublabel}</span>
              )}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-primary flex items-center gap-1.5 border-t"
              onMouseDown={handleCreate}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Criar <span className="font-medium">"{q}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
