'use client'

import { Sparkles, X, RotateCcw, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWhatsappStore } from '@/stores/whatsappStore'
import { useState } from 'react'

interface AiSuggestionBarProps {
  conversationId: string
  suggestion: string
  onUse: (text: string) => void
}

export function AiSuggestionBar({ conversationId, suggestion, onUse }: AiSuggestionBarProps) {
  const { clearAiSuggestion, setAiSuggestion } = useWhatsappStore()
  const [copied, setCopied] = useState(false)

  const regenerateMutation = useMutation({
    mutationFn: () => api.post<{ suggestion: string }>('/ai/suggest', { conversationId }),
    onSuccess: (data) => {
      setAiSuggestion(conversationId, data.suggestion)
    },
  })

  function handleCopy() {
    void navigator.clipboard.writeText(suggestion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-t border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 px-4 py-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Sugestão do Agente IA</span>
        </div>
        <button
          onClick={() => clearAiSuggestion(conversationId)}
          className="text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Texto da sugestão */}
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-white dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 px-3 py-2">
        {suggestion}
      </p>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white flex-1"
          onClick={() => { onUse(suggestion); clearAiSuggestion(conversationId) }}
        >
          Usar resposta
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50"
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
        >
          {regenerateMutation.isPending
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <RotateCcw className="h-3 w-3" />
          }
        </Button>
      </div>
    </div>
  )
}
