'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText, ImageIcon, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  accept?: string
  maxSizeMb?: number
  onFileSelected: (file: File) => void
  onClear?: () => void
  selectedFile?: File | null
  className?: string
  label?: string
  hint?: string
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon
  if (type.startsWith('audio/') || type.includes('mp3') || type.includes('mp4') || type.includes('wav')) return Music
  return FileText
}

export function FileUpload({
  accept = '*/*',
  maxSizeMb = 100,
  onFileSelected,
  onClear,
  selectedFile,
  className,
  label = 'Arraste um arquivo ou clique para selecionar',
  hint,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setError(null)
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo ${maxSizeMb}MB.`)
      return
    }
    onFileSelected(file)
  }

  const FileIcon = selectedFile ? getFileIcon(selectedFile.type) : Upload

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
          isDragging && 'border-primary bg-primary/5',
          selectedFile && 'border-green-400 bg-green-50',
          !isDragging && !selectedFile && 'border-muted-foreground/25 hover:border-primary/50',
          error && 'border-red-400 bg-red-50'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <FileIcon className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-green-700 max-w-[200px] truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onClear?.()
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Remover
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{label}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
