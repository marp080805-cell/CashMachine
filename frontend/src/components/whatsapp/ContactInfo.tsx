'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { WhatsappConversation } from '@/types'
import Link from 'next/link'

interface ContactInfoProps {
  conversation: WhatsappConversation
}

export function ContactInfo({ conversation }: ContactInfoProps) {
  return (
    <div className="w-72 border-l bg-card p-4 overflow-y-auto">
      <div className="text-center mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold mx-auto mb-3">
          {(conversation.remoteName ?? conversation.remotePhone)[0]?.toUpperCase()}
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
          <Button size="sm" variant="outline" className="text-xs">
            Vincular Lead
          </Button>
        </div>
      )}
    </div>
  )
}
