'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X } from 'lucide-react'
import { useFieldConfig } from '@/hooks/useFieldConfig'

interface Props {
  entityType: string
  slug: string
  label?: string                // label padrão exibido no modo de edição do nome
  defaultRequired?: boolean
  adminMode: boolean
  children: React.ReactNode
}

export function FieldWrapper({ entityType, slug, label: defaultLabel = '', defaultRequired = false, adminMode, children }: Props) {
  const { isRequired, setRequired, getLabel, setLabel, isUpdating } = useFieldConfig()
  const req = isRequired(entityType, slug, defaultRequired)
  const displayLabel = getLabel(entityType, slug, defaultLabel)

  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')

  function startEditLabel() {
    setLabelDraft(displayLabel)
    setEditingLabel(true)
  }

  function saveLabel() {
    if (labelDraft.trim()) setLabel(entityType, slug, labelDraft.trim())
    setEditingLabel(false)
  }

  return (
    <div className="space-y-1">
      {/* Barra de admin — aparece acima do campo em modo personalizar */}
      {adminMode && (
        <div className="flex items-center gap-1.5 rounded bg-muted/40 px-2 py-1 border border-dashed border-muted-foreground/20">
          {editingLabel ? (
            <>
              <Input
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false) }}
                className="h-6 text-xs px-1.5 py-0 flex-1"
                autoFocus
              />
              <Button type="button" size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={saveLabel} disabled={isUpdating}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => setEditingLabel(false)}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground flex-1 truncate">{displayLabel}</span>
              <Button
                type="button" size="icon" variant="ghost"
                className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100"
                onClick={startEditLabel}
                title="Renomear campo"
              >
                <Pencil className="h-2.5 w-2.5" />
              </Button>
              <Switch
                checked={req}
                onCheckedChange={(v) => setRequired(entityType, slug, v)}
                disabled={isUpdating}
                className="scale-[0.65] h-4 w-7 origin-right shrink-0"
              />
              <span className="text-[10px] shrink-0" style={{ color: req ? 'rgb(239 68 68)' : undefined }}>
                {req ? 'Obrigatório' : 'Opcional'}
              </span>
            </>
          )}
        </div>
      )}
      {/* Campo em si (Label + Input já renderizados pelo pai) */}
      {children}
    </div>
  )
}
