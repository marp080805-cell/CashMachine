'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

type FieldConfig = Record<string, Record<string, boolean>> // entityType → slug → required

export function useFieldConfig() {
  const qc = useQueryClient()
  const { data: config = {} } = useQuery<FieldConfig>({
    queryKey: ['field-config'],
    queryFn: () => api.get('/settings/field-config'),
  })

  const mutation = useMutation({
    mutationFn: (payload: { entityType: string; fieldSlug: string; required: boolean }) =>
      api.patch('/settings/field-config', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-config'] }),
  })

  function isRequired(entityType: string, fieldSlug: string, defaultVal = false): boolean {
    return config[entityType]?.[fieldSlug] ?? defaultVal
  }

  function setRequired(entityType: string, fieldSlug: string, required: boolean) {
    mutation.mutate({ entityType, fieldSlug, required })
  }

  return { config, isRequired, setRequired, isUpdating: mutation.isPending }
}
