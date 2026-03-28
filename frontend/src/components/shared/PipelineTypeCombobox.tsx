'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'

export const PREDEFINED_PIPELINE_TYPES = [
  { value: 'SALES', label: 'Vendas' },
  { value: 'TREATMENT', label: 'Atendimento' },
  { value: 'RESCUE', label: 'Resgate' },
  { value: 'RELATIONSHIP', label: 'Relacionamento' },
]

export function getPipelineTypeLabel(type: string, typeName?: string | null) {
  if (typeName) return typeName
  return PREDEFINED_PIPELINE_TYPES.find((t) => t.value === type)?.label ?? type
}

interface PipelineTypeComboboxProps {
  value: string
  typeName: string
  onChange: (type: string, typeName: string) => void
  existingTypeNames?: string[]
}

export function PipelineTypeCombobox({
  value,
  typeName,
  onChange,
  existingTypeNames = [],
}: PipelineTypeComboboxProps) {
  const displayValue = typeName || PREDEFINED_PIPELINE_TYPES.find((t) => t.value === value)?.label || ''
  const [inputVal, setInputVal] = useState(displayValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputVal(typeName || PREDEFINED_PIPELINE_TYPES.find((t) => t.value === value)?.label || '')
  }, [value, typeName])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        commitValue(inputVal)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })

  function commitValue(val: string) {
    const trimmed = val.trim()
    if (!trimmed) return
    const match = PREDEFINED_PIPELINE_TYPES.find((t) => t.label.toLowerCase() === trimmed.toLowerCase())
    if (match) onChange(match.value, '')
    else onChange('CUSTOM', trimmed)
  }

  const allSuggestions = [
    ...PREDEFINED_PIPELINE_TYPES.map((t) => ({ label: t.label, type: t.value, typeName: '' })),
    ...existingTypeNames
      .filter((n) => !PREDEFINED_PIPELINE_TYPES.some((t) => t.label.toLowerCase() === n.toLowerCase()))
      .map((n) => ({ label: n, type: 'CUSTOM', typeName: n })),
  ]

  const filtered = inputVal
    ? allSuggestions.filter((s) => s.label.toLowerCase().includes(inputVal.toLowerCase()))
    : allSuggestions

  const isNew =
    inputVal.trim() &&
    !PREDEFINED_PIPELINE_TYPES.some((t) => t.label.toLowerCase() === inputVal.trim().toLowerCase()) &&
    !existingTypeNames.some((n) => n.toLowerCase() === inputVal.trim().toLowerCase())

  return (
    <div ref={ref} className="relative">
      <Input
        value={inputVal}
        onChange={(e) => { setInputVal(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commitValue(inputVal); setOpen(false) }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Selecione ou digite um tipo..."
      />
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
          {filtered.length === 0 && inputVal ? (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={() => { onChange('CUSTOM', inputVal.trim()); setInputVal(inputVal.trim()); setOpen(false) }}
            >
              <span className="text-muted-foreground mr-1">Criar tipo:</span>
              <span className="font-medium">{inputVal.trim()}</span>
            </button>
          ) : (
            <>
              {filtered.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                  onMouseDown={() => { onChange(s.type, s.typeName); setInputVal(s.label); setOpen(false) }}
                >
                  {s.label}
                </button>
              ))}
              {isNew && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm border-t hover:bg-accent text-muted-foreground"
                  onMouseDown={() => { onChange('CUSTOM', inputVal.trim()); setInputVal(inputVal.trim()); setOpen(false) }}
                >
                  <span className="mr-1">Criar tipo:</span>
                  <span className="font-medium text-foreground">{inputVal.trim()}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
