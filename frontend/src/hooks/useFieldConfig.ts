'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface FieldConfigResponse {
  fieldRequired: Record<string, Record<string, boolean>>
  fieldLabels: Record<string, Record<string, string>>
}

export function useFieldConfig() {
  const qc = useQueryClient()
  const { data } = useQuery<FieldConfigResponse>({
    queryKey: ['field-config'],
    queryFn: () => api.get('/settings/field-config'),
    staleTime: 30_000,
  })

  const fieldRequired = data?.fieldRequired ?? {}
  const fieldLabels = data?.fieldLabels ?? {}

  const mutation = useMutation({
    mutationFn: (payload: { entityType: string; fieldSlug: string; required?: boolean; label?: string }) =>
      api.patch('/settings/field-config', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-config'] }),
  })

  function isRequired(entityType: string, fieldSlug: string, defaultVal = false): boolean {
    return fieldRequired[entityType]?.[fieldSlug] ?? defaultVal
  }

  function getLabel(entityType: string, fieldSlug: string, defaultLabel: string): string {
    return fieldLabels[entityType]?.[fieldSlug] ?? defaultLabel
  }

  function setRequired(entityType: string, fieldSlug: string, required: boolean) {
    mutation.mutate({ entityType, fieldSlug, required })
  }

  function setLabel(entityType: string, fieldSlug: string, label: string) {
    mutation.mutate({ entityType, fieldSlug, label })
  }

  return { isRequired, getLabel, setRequired, setLabel, isUpdating: mutation.isPending }
}
