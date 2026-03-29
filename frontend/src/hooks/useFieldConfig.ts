'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface FieldConfigResponse {
  fieldRequired: Record<string, Record<string, boolean>>
  fieldLabels: Record<string, Record<string, string>>
  fieldPlaceholders: Record<string, Record<string, string>>
  fieldHidden: Record<string, Record<string, boolean>>
  fieldOptions: Record<string, Record<string, string[]>>
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
  const fieldPlaceholders = data?.fieldPlaceholders ?? {}
  const fieldHidden = data?.fieldHidden ?? {}
  const fieldOptions = data?.fieldOptions ?? {}

  const mutation = useMutation({
    mutationFn: (payload: { entityType: string; fieldSlug: string; required?: boolean; label?: string; placeholder?: string; hidden?: boolean; options?: string[] }) =>
      api.patch('/settings/field-config', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-config'] }),
  })

  function isRequired(entityType: string, fieldSlug: string, defaultVal = false): boolean {
    return fieldRequired[entityType]?.[fieldSlug] ?? defaultVal
  }

  function getLabel(entityType: string, fieldSlug: string, defaultLabel: string): string {
    return fieldLabels[entityType]?.[fieldSlug] ?? defaultLabel
  }

  function getPlaceholder(entityType: string, fieldSlug: string, defaultPlaceholder: string): string {
    return fieldPlaceholders[entityType]?.[fieldSlug] ?? defaultPlaceholder
  }

  function isHidden(entityType: string, fieldSlug: string): boolean {
    return fieldHidden[entityType]?.[fieldSlug] ?? false
  }

  function setRequired(entityType: string, fieldSlug: string, required: boolean) {
    mutation.mutate({ entityType, fieldSlug, required })
  }

  function setLabel(entityType: string, fieldSlug: string, label: string) {
    mutation.mutate({ entityType, fieldSlug, label })
  }

  function setPlaceholder(entityType: string, fieldSlug: string, placeholder: string) {
    mutation.mutate({ entityType, fieldSlug, placeholder })
  }

  function setHidden(entityType: string, fieldSlug: string, hidden: boolean) {
    mutation.mutate({ entityType, fieldSlug, hidden })
  }

  function getOptions(entityType: string, fieldSlug: string, defaultOptions: string[]): string[] {
    return fieldOptions[entityType]?.[fieldSlug] ?? defaultOptions
  }

  function setOptions(entityType: string, fieldSlug: string, options: string[]) {
    mutation.mutate({ entityType, fieldSlug, options })
  }

  return { isRequired, getLabel, getPlaceholder, isHidden, getOptions, setRequired, setLabel, setPlaceholder, setHidden, setOptions, isUpdating: mutation.isPending }
}
