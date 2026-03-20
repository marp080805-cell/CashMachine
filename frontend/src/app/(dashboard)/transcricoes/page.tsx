'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { FileUpload } from '@/components/shared/FileUpload'
import { Upload, Mic, FileAudio, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CallTranscription {
  id: string
  leadId: string | null
  audioUrl: string
  transcription: string | null
  analysis: {
    summary?: string
    nextSteps?: string[]
    sentiment?: string
    keyPoints?: string[]
    objections?: string[]
  } | null
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR'
  duration: number | null
  createdAt: string
  lead?: { name: string } | null
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pendente', icon: Clock, className: 'bg-slate-100 text-slate-600' },
  PROCESSING: { label: 'Processando', icon: Loader2, className: 'bg-blue-100 text-blue-600' },
  DONE: { label: 'Concluído', icon: CheckCircle2, className: 'bg-green-100 text-green-600' },
  ERROR: { label: 'Erro', icon: XCircle, className: 'bg-red-100 text-red-600' },
}

function TranscriptionDetail({ item }: { item: CallTranscription }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <FileAudio className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {item.lead?.name ?? 'Sem lead vinculado'}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.duration && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
              </span>
            )}
            {(() => {
              const cfg = STATUS_CONFIG[item.status]
              const Icon = cfg.icon
              return (
                <Badge className={cn('text-xs', cfg.className)}>
                  <Icon className={cn('h-3 w-3 mr-1', item.status === 'PROCESSING' && 'animate-spin')} />
                  {cfg.label}
                </Badge>
              )
            })()}
            {item.status === 'DONE' && (
              <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {expanded && item.status === 'DONE' && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {item.analysis?.summary && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resumo</p>
                <p className="text-sm text-gray-700">{item.analysis.summary}</p>
              </div>
            )}
            {item.analysis?.sentiment && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Sentimento</p>
                <Badge variant="secondary">{item.analysis.sentiment}</Badge>
              </div>
            )}
            {item.analysis?.keyPoints && item.analysis.keyPoints.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pontos-chave</p>
                <ul className="space-y-1">
                  {item.analysis.keyPoints.map((point, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.analysis?.objections && item.analysis.objections.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Objeções</p>
                <ul className="space-y-1">
                  {item.analysis.objections.map((obj, i) => (
                    <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.analysis?.nextSteps && item.analysis.nextSteps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Próximos Passos</p>
                <ul className="space-y-1">
                  {item.analysis.nextSteps.map((step, i) => (
                    <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.transcription && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Transcrição Completa</p>
                <div className="rounded-md bg-slate-50 p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{item.transcription}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function TranscricoesPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)

  const { data, isLoading } = useQuery({
    queryKey: ['transcriptions'],
    queryFn: () => api.get<{ transcriptions: CallTranscription[] }>('/transcriptions'),
    refetchInterval: 15000,
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return
      const formData = new FormData()
      formData.append('audio', selectedFile)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: formData,
      })
      if (!response.ok) throw new Error('Upload failed')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Áudio enviado para transcrição!')
      setUploadOpen(false)
      setSelectedFile(null)
      void queryClient.invalidateQueries({ queryKey: ['transcriptions'] })
    },
    onError: () => toast.error('Erro ao enviar áudio'),
  })

  const transcriptions = data?.transcriptions ?? []
  const pending = transcriptions.filter((t) => t.status === 'PENDING' || t.status === 'PROCESSING').length
  const done = transcriptions.filter((t) => t.status === 'DONE').length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Transcrições de Chamadas</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {pending > 0 && (
            <Badge className="bg-blue-100 text-blue-600">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {pending} processando
            </Badge>
          )}
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Enviar Áudio
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: transcriptions.length, color: 'text-gray-900' },
          { label: 'Processando', value: pending, color: 'text-blue-600' },
          { label: 'Concluídos', value: done, color: 'text-green-600' },
          { label: 'Erros', value: transcriptions.filter((t) => t.status === 'ERROR').length, color: 'text-red-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transcription list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : transcriptions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mic className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma transcrição ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Envie um áudio para começar</p>
            <Button className="mt-4" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Enviar Áudio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transcriptions.map((item) => (
            <TranscriptionDetail key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Áudio para Transcrição</DialogTitle>
          </DialogHeader>

          <FileUpload
            accept="audio/*"
            maxSizeMb={100}
            selectedFile={selectedFile}
            onFileSelected={setSelectedFile}
            onClear={() => setSelectedFile(null)}
            label="Arraste um arquivo de áudio"
            hint="MP3, MP4, WAV, M4A, OGG até 100MB"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setSelectedFile(null) }}>
              Cancelar
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Enviar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
