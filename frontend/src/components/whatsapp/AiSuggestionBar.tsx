'use client'

import { Sparkles, X, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWhatsappStore } from '@/stores/whatsappStore'

interface AiSuggestionBarProps {
  conversationId: string
  suggestion: string
  onUse: (text: string) => void
}

export function AiSuggestionBar({ conversationId, suggestion, onUse }: AiSuggestionBarProps) {
  const { clearAiSuggestion, setAiSuggestion } = useWhatsappStore()

  const regenerateMutation = useMutation({
    mutationFn: () => api.post<{ suggestion: string }>('/ai/suggest', { conversationId }),
    onSuccess: (data) => {
      setAiSuggestion(conversationId, data.suggestion)
    },
  })

  return (
    <div className="border-t bg-violet-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1.5 mt-0.5">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="text-xs font-semibold text-violet-600">Sugestão IA:</span>
        </div>
        <p className="flex-1 text-sm text-gray-800 line-clamp-2">{suggestion}</p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button
          size="sm"
          className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
          onClick={() => { onUse(suggestion); clearAiSuggestion(conversationId) }}
        >
          Usar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => clearAiSuggestion(conversationId)}
        >
          Ignorar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
        >
          {regenerateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RotateCcw className="h-3 w-3 mr-1" />
          )}
          Gerar outra
        </Button>
      </div>
    </div>
  )
}
