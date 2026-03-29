'use client'

import { useState } from 'react'
import React from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X, EyeOff, Eye } from 'lucide-react'
import { useFieldConfig } from '@/hooks/useFieldConfig'

interface Props {
  entityType: string
  slug: string
  label?: string             // displayed label text (default); optional for backward compat
  placeholder?: string       // default placeholder text
  defaultRequired?: boolean
  adminMode: boolean
  children: React.ReactNode
  className?: string
  configContent?: React.ReactNode  // extra admin config rendered inside the edit panel
}

export function FieldWrapper({
  entityType, slug, label: defaultLabel = '', placeholder: defaultPlaceholder = '',
  defaultRequired = false, adminMode, children, className = '', configContent,
}: Props) {
  const { isRequired, getLabel, getPlaceholder, isHidden, setRequired, setLabel, setPlaceholder, setHidden, isUpdating } = useFieldConfig()

  const req = isRequired(entityType, slug, defaultRequired)
  const displayLabel = getLabel(entityType, slug, defaultLabel)
  const displayPlaceholder = getPlaceholder(entityType, slug, defaultPlaceholder)
  const hidden = isHidden(entityType, slug)

  const [editing, setEditing] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [placeholderDraft, setPlaceholderDraft] = useState('')

  // In normal mode, hidden fields are invisible
  if (!adminMode && hidden) return null

  function startEdit() {
    setLabelDraft(displayLabel)
    setPlaceholderDraft(displayPlaceholder)
    setEditing(true)
  }

  function saveEdit() {
    if (labelDraft.trim()) setLabel(entityType, slug, labelDraft.trim())
    if (placeholderDraft !== displayPlaceholder) setPlaceholder(entityType, slug, placeholderDraft)
    setEditing(false)
  }

  // Inject placeholder into direct child input if possible
  const childWithPlaceholder = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ placeholder?: string; required?: boolean }>, {
        placeholder: displayPlaceholder || undefined,
        required: req || undefined,
      })
    : children

  return (
    <div className={`space-y-1.5 ${hidden && adminMode ? 'opacity-50' : ''} ${className}`}>
      {/* Label row */}
      {editing ? (
        /* Edit panel — replaces label row when pencil is clicked */
        <div className="rounded-md border border-primary/20 bg-muted/30 p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Nome do campo</span>
              <Input
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
                className="h-7 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Texto de exemplo</span>
              <Input
                value={placeholderDraft}
                onChange={(e) => setPlaceholderDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
                className="h-7 text-sm"
                placeholder="Ex: Digite aqui..."
              />
            </div>
          </div>
          {configContent && (
            <div className="border-t pt-2 mt-1">
              {configContent}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={req} onCheckedChange={(v) => setRequired(entityType, slug, v)} disabled={isUpdating} className="scale-75 h-4 w-7" />
              <span className="text-xs text-muted-foreground">{req ? 'Obrigatório' : 'Opcional'}</span>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-6 text-[10px] gap-1 text-muted-foreground ml-1"
                onClick={() => setHidden(entityType, slug, !hidden)}
                disabled={isUpdating}
              >
                {hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {hidden ? 'Mostrar' : 'Ocultar'}
              </Button>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
              <Button type="button" size="sm" className="h-6 text-xs gap-1" onClick={saveEdit} disabled={isUpdating || !labelDraft.trim()}>
                <Check className="h-3 w-3" /> Salvar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 min-h-[18px]">
          <Label className={hidden && adminMode ? 'line-through text-muted-foreground' : ''}>
            {displayLabel}
            {req && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          {adminMode && (
            <>
              <Button
                type="button" size="icon" variant="ghost"
                className="h-4 w-4 ml-0.5 opacity-40 hover:opacity-100 flex-shrink-0"
                onClick={startEdit}
                title="Editar campo"
              >
                <Pencil className="h-2.5 w-2.5" />
              </Button>
              <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                <Switch
                  checked={req}
                  onCheckedChange={(v) => setRequired(entityType, slug, v)}
                  disabled={isUpdating}
                  className="scale-[0.65] h-4 w-7 origin-right"
                />
                <span className="text-[10px] text-muted-foreground">{req ? 'Obrigatório' : 'Opcional'}</span>
              </div>
            </>
          )}
        </div>
      )}
      {/* The actual input — faded when editing */}
      <div className={editing ? 'opacity-40 pointer-events-none' : ''}>
        {childWithPlaceholder}
      </div>
    </div>
  )
}
