'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Tag as TagIcon, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Tag } from '@/types'

interface Props {
  entityType: 'contact' | 'lead' | 'company' | 'opportunity'
  entityId: string
  queryKey: string[]
}

export function EntityTagsSection({ entityType, entityId, queryKey }: Props) {
  const queryClient = useQueryClient()
  const [showPicker, setShowPicker] = useState(false)

  // Returns Tag[] directly
  const { data: assignedTags = [] } = useQuery({
    queryKey: ['entity-tags', entityType, entityId],
    queryFn: () => api.get<Tag[]>(`/tags/entity/${entityType}/${entityId}`),
    enabled: !!entityId,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags-list', entityType],
    queryFn: () => api.get<Tag[]>(`/tags?entityType=${entityType}`),
    enabled: showPicker,
  })

  const addMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.post(`/tags/assign`, { tagId, entityType, entityId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['entity-tags', entityType, entityId] })
      void queryClient.invalidateQueries({ queryKey: queryKey })
    },
    onError: () => toast.error('Erro ao adicionar tag'),
  })

  const removeMutation = useMutation({
    mutationFn: (tagId: string) =>
      api.post(`/tags/unassign`, { tagId, entityType, entityId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['entity-tags', entityType, entityId] })
      void queryClient.invalidateQueries({ queryKey: queryKey })
    },
    onError: () => toast.error('Erro ao remover tag'),
  })

  const available = allTags.filter((t) => !assignedTags.some((a) => a.id === t.id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          <TagIcon className="h-3 w-3" /> Tags
        </span>
        <Button
          size="sm"
          variant={showPicker ? 'default' : 'outline'}
          className="h-6 text-xs px-2"
          onClick={() => setShowPicker((v) => !v)}
        >
          <Plus className="h-3 w-3 mr-1" />
          {showPicker ? 'Fechar' : 'Adicionar'}
        </Button>
      </div>

      {showPicker && (
        <div className="border rounded-md p-2 bg-muted/30 space-y-1 max-h-40 overflow-y-auto">
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todas as tags já foram adicionadas</p>
          ) : (
            available.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-sm"
                onClick={() => { addMutation.mutate(tag.id); setShowPicker(false) }}
              >
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {assignedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeMutation.mutate(tag.id)}
              className="hover:opacity-75"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {assignedTags.length === 0 && !showPicker && (
          <span className="text-xs text-muted-foreground">Nenhuma tag</span>
        )}
      </div>
    </div>
  )
}
