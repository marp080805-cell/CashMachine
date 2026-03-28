'use client'

import { Switch } from '@/components/ui/switch'
import { useFieldConfig } from '@/hooks/useFieldConfig'

interface Props {
  entityType: string
  slug: string
  defaultRequired?: boolean
  adminMode: boolean
  children: React.ReactNode
}

export function FieldWrapper({ entityType, slug, defaultRequired = false, adminMode, children }: Props) {
  const { isRequired, setRequired, isUpdating } = useFieldConfig()
  const req = isRequired(entityType, slug, defaultRequired)

  return (
    <div className="space-y-1">
      {children}
      {adminMode && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <Switch
            checked={req}
            onCheckedChange={(v) => setRequired(entityType, slug, v)}
            disabled={isUpdating}
            className="scale-[0.65] h-4 w-7 origin-left"
          />
          <span className="text-[10px] text-muted-foreground">
            {req ? 'Obrigatório' : 'Opcional'}
          </span>
        </div>
      )}
    </div>
  )
}
