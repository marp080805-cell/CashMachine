'use client'

import { useState } from 'react'
import { ExternalLink, Link as LinkIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { WhatsappConversation, Lead } from '@/types'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface ContactInfoProps {
  conversation: WhatsappConversation
}

export function ContactInfo({ conversation }: ContactInfoProps) {
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const { data: leadsData } = useQuery({
    queryKey: ['leads-link-search', searchQuery],
    queryFn: () =>
      api.get<{ leads: Lead[] }>(
        `/leads?limit=10${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
      ),
    enabled: showLinkModal,
  })

  const linkMutation = useMutation({
    mutationFn: (leadId: string) =>
      api.post(`/whatsapp/conversations/${conversation.id}/link-lead`, { leadId }),
    onSuccess: () => {
      toast.success('Lead vinculado!')
      setShowLinkModal(false)
      setSearchQuery('')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
    },
    onError: () => toast.error('Erro ao vincular lead'),
  })

  function handleClose(open: boolean) {
    setShowLinkModal(open)
    if (!open) setSearchQuery('')
  }

  return (
    <div className="w-72 border-l bg-card p-4 overflow-y-auto">
      <div className="text-center mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold mx-auto mb-3">
          {(conversation.remoteName ?? conversation.remotePhone ?? '?')[0]?.toUpperCase()}
        </div>
        <h3 className="font-semibold text-foreground">{conversation.remoteName ?? 'Desconhecido'}</h3>
        <p className="text-sm text-muted-foreground">{conversation.remotePhone}</p>
      </div>

      {conversation.lead ? (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead vinculado</h4>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{conversation.lead.name}</span>
              <Link href={`/leads/${conversation.lead.id}`}>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            <Badge variant="secondary" className="text-xs">{conversation.lead.status}</Badge>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground mb-3">Nenhum lead vinculado</p>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setShowLinkModal(true)}
          >
            <LinkIcon className="h-3 w-3 mr-1" />
            Vincular Lead
          </Button>
        </div>
      )}

      <Dialog open={showLinkModal} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Lead à Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input
              placeholder="Buscar lead por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
              {(leadsData?.leads ?? []).length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {searchQuery ? 'Nenhum lead encontrado' : 'Digite para buscar leads...'}
                </p>
              ) : (
                (leadsData?.leads ?? []).map((lead) => (
                  <button
                    key={lead.id}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted flex items-center justify-between gap-2 disabled:opacity-50"
                    onClick={() => linkMutation.mutate(lead.id)}
                    disabled={linkMutation.isPending}
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{lead.name}</span>
                      {lead.company && (
                        <span className="text-muted-foreground ml-2 text-xs truncate">
                          — {lead.company.name}
                        </span>
                      )}
                    </div>
                    {linkMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    ) : (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {lead.status}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
