'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Mic, Upload, Loader2, CheckCircle2, AlertCircle,
  Clock, FileAudio, ThumbsUp, ChevronRight,
} from 'lucide-react'
import { cn, formatDateTime, formatDate } from '@/lib/utils'

// ── Types ──

interface RecordingOpportunity {
  id: string
  title: string
}

interface RecordingUser {
  id: string
  name: string
}

interface AIAnalysis {
  pontos_positivos?: string[]
  objecoes?: string[]
  oportunidades_perdidas?: string[]
  proximo_passo?: string
  score?: number
  justificativa_score?: string
  strengths?: string[]
  improvements?: string[]
  scores?: Record<string, number>
}

interface TranscriptionSegment {
  speaker?: string
  text: string
  start?: number
  end?: number
}

interface Recording {
  id: string
  fileName: string
  fileUrl?: string | null
  status: string
  transcriptionText?: string | null
  transcriptionSegments?: TranscriptionSegment[] | null
  aiAnalysis?: AIAnalysis | null
  closerId?: string | null
  assignedTo?: RecordingUser | null
  opportunity?: RecordingOpportunity | null
  createdAt: string
  updatedAt?: string
  generatedTasks?: Array<{ id: string; title: string; type: string }>
}

// ── Constants ──

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  UPLOADING: { label: 'Enviando', color: 'bg-blue-100 text-blue-700', icon: Upload },
  TRANSCRIBING: { label: 'Transcrevendo', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ANALYZING: { label: 'Analisando', color: 'bg-orange-100 text-orange-700', icon: Clock },
  DONE: { label: 'Concluído', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  FAILED: { label: 'Falhou', color: 'bg-red-100 text-red-700', icon: AlertCircle },
}

// ── ScoreGauge ──

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 7 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600'
  const bg = score >= 7 ? 'bg-green-100' : score >= 5 ? 'bg-yellow-100' : 'bg-red-100'
  return (
    <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', bg, color)}>
      <ThumbsUp className="h-3 w-3" />
      {score.toFixed(1)}
    </div>
  )
}

// ── RecordingCard ──

function RecordingCard({ recording, onClick }: { recording: Recording; onClick: () => void }) {
  const status = statusConfig[recording.status] ?? { label: recording.status, color: 'bg-gray-100 text-gray-600', icon: FileAudio }
  const StatusIcon = status.icon

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors flex items-center gap-3"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <FileAudio className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{recording.fileName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {recording.assignedTo && (
            <span className="text-xs text-muted-foreground">{recording.assignedTo.name}</span>
          )}
          {recording.opportunity && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              · {recording.opportunity.title}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(recording.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {recording.aiAnalysis?.score !== undefined && (
          <ScoreGauge score={recording.aiAnalysis.score} />
        )}
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1', status.color)}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  )
}

// ── RecordingDetailSheet ──

function RecordingDetailSheet({
  recording,
  open,
  onClose,
}: {
  recording: Recording | null
  open: boolean
  onClose: () => void
}) {
  if (!recording) return null

  const analysis = recording.aiAnalysis
  const hasTranscription = !!recording.transcriptionText || (recording.transcriptionSegments && recording.transcriptionSegments.length > 0)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{recording.fileName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="text-muted-foreground">{formatDateTime(recording.createdAt)}</span>
            {recording.assignedTo && (
              <span className="text-muted-foreground">· {recording.assignedTo.name}</span>
            )}
            {recording.opportunity && (
              <Badge variant="outline" className="text-xs">{recording.opportunity.title}</Badge>
            )}
          </div>

          {/* Audio Player */}
          {recording.fileUrl && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Áudio</p>
              <audio controls src={recording.fileUrl} className="w-full" />
            </div>
          )}

          {/* AI Score */}
          {analysis?.score !== undefined && (
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="font-medium text-sm">Score IA</span>
              <ScoreGauge score={analysis.score} />
            </div>
          )}

          {/* AI Analysis */}
          {analysis && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Análise da IA</p>

              {analysis.justificativa_score && (
                <p className="text-sm text-muted-foreground">{analysis.justificativa_score}</p>
              )}

              {(analysis.pontos_positivos ?? analysis.strengths)?.length ? (
                <div>
                  <p className="text-xs font-medium text-green-700 mb-1">Pontos Positivos</p>
                  <ul className="space-y-1">
                    {(analysis.pontos_positivos ?? analysis.strengths ?? []).map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-green-500 shrink-0">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(analysis.objecoes ?? analysis.improvements)?.length ? (
                <div>
                  <p className="text-xs font-medium text-orange-700 mb-1">
                    {analysis.objecoes ? 'Objeções' : 'Melhorias'}
                  </p>
                  <ul className="space-y-1">
                    {(analysis.objecoes ?? analysis.improvements ?? []).map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-orange-500 shrink-0">!</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {analysis.oportunidades_perdidas?.length ? (
                <div>
                  <p className="text-xs font-medium text-red-700 mb-1">Oportunidades Perdidas</p>
                  <ul className="space-y-1">
                    {analysis.oportunidades_perdidas.map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-red-500 shrink-0">✗</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {analysis.proximo_passo && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-2">
                  <p className="text-xs font-medium text-blue-700 mb-0.5">Próximo Passo</p>
                  <p className="text-xs text-blue-800">{analysis.proximo_passo}</p>
                </div>
              )}

              {analysis.scores && Object.keys(analysis.scores).length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Scores Detalhados</p>
                  <div className="space-y-1.5">
                    {Object.entries(analysis.scores).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground capitalize w-32 truncate">{key.replace(/_/g, ' ')}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, (val / 10) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transcription */}
          {hasTranscription && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Transcrição</p>
              {recording.transcriptionSegments && recording.transcriptionSegments.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border p-3 text-xs">
                  {recording.transcriptionSegments.map((seg, i) => (
                    <div key={i}>
                      {seg.speaker && (
                        <span className="font-semibold text-primary">{seg.speaker}: </span>
                      )}
                      <span className="text-muted-foreground">{seg.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {recording.transcriptionText}
                </div>
              )}
            </div>
          )}

          {/* Generated Tasks */}
          {recording.generatedTasks && recording.generatedTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Tarefas Geradas</p>
              <ul className="space-y-1">
                {recording.generatedTasks.map((t) => (
                  <li key={t.id} className="text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pending state */}
          {!hasTranscription && !analysis && recording.status !== 'DONE' && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {statusConfig[recording.status]?.label ?? 'Aguardando'} — recarregue para atualizar
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── UploadModal ──

interface Opportunity {
  id: string
  title: string
}

function UploadModal({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [opportunityId, setOpportunityId] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const token = useAuthStore((s) => s.token)

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities-simple'],
    queryFn: () => api.get<Opportunity[]>('/opportunities?limit=100&status=OPEN'),
    enabled: open,
  })

  const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? ''

  async function handleUpload() {
    if (!file) { toast.error('Selecione um arquivo'); return }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (opportunityId) formData.append('opportunityId', opportunityId)

      const res = await fetch(`${API_URL}/recordings/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Upload falhou')
      toast.success('Gravação enviada com sucesso!')
      onUploaded()
      handleClose()
    } catch {
      toast.error('Erro ao fazer upload')
    } finally {
      setIsUploading(false)
    }
  }

  function handleClose() {
    setFile(null)
    setOpportunityId('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload de Gravação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Arquivo de Áudio <span className="text-red-500">*</span></Label>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.ogg,.webm"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div
              className={cn(
                'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/50 transition-colors',
                file && 'border-primary bg-primary/5',
              )}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="space-y-1">
                  <FileAudio className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar um arquivo</p>
                  <p className="text-xs text-muted-foreground">MP3, MP4, WAV, M4A, OGG</p>
                </div>
              )}
            </div>
          </div>

          {opportunities.length > 0 && (
            <div className="space-y-1.5">
              <Label>Oportunidade Vinculada (opcional)</Label>
              <Select value={opportunityId || 'NONE'} onValueChange={(v) => setOpportunityId(v === 'NONE' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Nenhuma</SelectItem>
                  {opportunities.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={() => void handleUpload()} disabled={isUploading || !file}>
              {isUploading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                : <><Upload className="h-4 w-4 mr-2" />Enviar</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──

export default function GracoesPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings'],
    queryFn: () => api.get<Recording[]>('/recordings'),
  })

  function handleUploaded() {
    void queryClient.invalidateQueries({ queryKey: ['recordings'] })
  }

  function handleRecordingClick(recording: Recording) {
    setSelectedRecording(recording)
    setDetailOpen(true)
  }

  const countsByStatus = recordings.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Gravações</h1>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      {/* Status summary */}
      {recordings.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(countsByStatus).map(([status, count]) => {
            const cfg = statusConfig[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' }
            return (
              <span key={status} className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                {cfg.label}: {count}
              </span>
            )
          })}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mic className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma gravação ainda</p>
          <Button size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Fazer Upload
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {recordings.map((rec) => (
            <RecordingCard
              key={rec.id}
              recording={rec}
              onClick={() => handleRecordingClick(rec)}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />

      {/* Detail Sheet */}
      <RecordingDetailSheet
        recording={selectedRecording}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
