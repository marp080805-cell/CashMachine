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
  label?: string               // default label (used if no custom label saved); if omitted, no label header is rendered
  defaultRequired?: boolean
  adminMode: boolean
  children: React.ReactNode
}

export function FieldWrapper({ entityType, slug, label: defaultLabel = '', defaultRequired = false, adminMode, children }: Props) {
  const { isRequired, setRequired, getLabel, setLabel, isUpdating } = useFieldConfig()
  const req = isRequired(entityType, slug, defaultRequired)
  const displayLabel = getLabel(entityType, slug, defaultLabel)

  const [editing, setEditing] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')

  function startEdit() {
    setLabelDraft(displayLabel)
    setEditing(true)
  }

  function saveLabel() {
    if (labelDraft.trim() && labelDraft !== displayLabel) {
      setLabel(entityType, slug, labelDraft.trim())
    }
    setEditing(false)
  }

  // Only render the label header row when a label prop was explicitly provided
  const showLabelHeader = defaultLabel !== ''

  return (
    <div className="space-y-1">
      {showLabelHeader && (
        <div className="flex items-center gap-1 min-h-5">
          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditing(false) }}
                className="h-6 text-xs px-1.5 py-0 flex-1"
                autoFocus
              />
              <Button type="button" size="icon" variant="ghost" className="h-5 w-5" onClick={saveLabel} disabled={isUpdating}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <span className="text-sm font-medium leading-none">
                {displayLabel}
                {req && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              {adminMode && (
                <Button type="button" size="icon" variant="ghost" className="h-4 w-4 ml-0.5 opacity-50 hover:opacity-100" onClick={startEdit}>
                  <Pencil className="h-2.5 w-2.5" />
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {children}
      {adminMode && !editing && (
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
