'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag as TagIcon, X, ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import type { Tag } from '@/types'
import { toast } from 'sonner'

interface TagFieldProps {
  entityType: string
  label?: string
  // Edit mode: pass entityId to connect to API directly
  entityId?: string
  queryKey?: string[]
  queryKeys?: string[][]  // extra query keys to invalidate (e.g. pipeline cache)
  // Create mode: pass value + onChange for controlled behavior
  value?: string[]
  onChange?: (ids: string[]) => void
}

export function TagField({
  entityType,
  label = 'Tags',
  entityId,
  queryKey = [],
  queryKeys = [],
  value,
  onChange,
}: TagFieldProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isEditMode = !!entityId

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: assignedTags = [] } = useQuery({
    queryKey: ['entity-tags', entityType, entityId],
    queryFn: () => api.get<Tag[]>(`/tags/entity/${entityType}/${entityId!}`),
    enabled: isEditMode,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags-list', entityType],
    queryFn: () => api.get<Tag[]>(`/tags?entityType=${entityType}`),
  })

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['entity-tags', entityType, entityId] })
    if (queryKey.length) void queryClient.invalidateQueries({ queryKey })
    queryKeys.forEach((qk) => void queryClient.invalidateQueries({ queryKey: qk }))
  }

  const addMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.post('/tags/assign', { tagId, entityType, entityId }),
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao adicionar tag'),
  })

  const removeMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.post('/tags/unassign', { tagId, entityType, entityId }),
    onSuccess: invalidateAll,
    onError: () => toast.error('Erro ao remover tag'),
  })

  const displayed = isEditMode
    ? assignedTags
    : allTags.filter((t) => (value ?? []).includes(t.id))

  const available = allTags.filter((t) => !displayed.some((d) => d.id === t.id))

  function handleAdd(tagId: string) {
    if (isEditMode) addMutation.mutate(tagId)
    else onChange?.([...(value ?? []), tagId])
    setOpen(false)
  }

  function handleRemove(tagId: string) {
    if (isEditMode) removeMutation.mutate(tagId)
    else onChange?.((value ?? []).filter((id) => id !== tagId))
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <div ref={ref} className="relative">
        <div
          className="flex flex-wrap gap-1.5 items-center min-h-9 px-3 py-1.5 rounded-md border border-input bg-background cursor-pointer hover:border-ring transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          {displayed.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(tag.id) }}
                className="hover:opacity-75 ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {displayed.length === 0 && (
            <span className="text-sm text-muted-foreground select-none">
              {allTags.length === 0 ? 'Nenhuma tag cadastrada' : 'Clique para adicionar tags...'}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground ml-auto flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
        {open && (
          <div className="absolute z-50 left-0 top-full mt-1 bg-popover border rounded-md shadow-md w-full max-h-48 overflow-y-auto">
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">
                {allTags.length === 0
                  ? 'Nenhuma tag cadastrada para este tipo'
                  : 'Todas as tags já foram adicionadas'}
              </p>
            ) : (
              available.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => handleAdd(tag.id)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
