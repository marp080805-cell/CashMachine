import { Check, CheckCheck, Image, FileText, Play } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import type { WhatsappMessage } from '@/types'

const statusIcons = {
  PENDING: null,
  SENT: Check,
  DELIVERED: CheckCheck,
  READ: CheckCheck,
  FAILED: null,
}

interface MessageBubbleProps {
  message: WhatsappMessage
  showDate?: boolean
  dateLabel?: string
}

export function MessageBubble({ message, showDate, dateLabel }: MessageBubbleProps) {
  const StatusIcon = statusIcons[message.status]

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-4">
          <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
            {dateLabel}
          </span>
        </div>
      )}
      <div className={cn('flex', message.fromMe ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm',
            message.fromMe
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-white text-gray-900 rounded-tl-sm border'
          )}
        >
          {message.type === 'IMAGE' && (
            <div className="mb-1">
              {message.mediaUrl ? (
                <img
                  src={message.mediaUrl}
                  alt="Imagem"
                  className="rounded-lg max-h-48 cursor-pointer"
                  onClick={() => message.mediaUrl && window.open(message.mediaUrl, '_blank')}
                />
              ) : (
                <div className="flex items-center gap-2 text-xs opacity-70">
                  <Image className="h-4 w-4" />
                  <span>Imagem</span>
                </div>
              )}
            </div>
          )}

          {message.type === 'AUDIO' && (
            <div className="flex items-center gap-2 mb-1">
              <Play className="h-4 w-4" />
              {message.mediaUrl && (
                <audio controls src={message.mediaUrl} className="h-8 max-w-[200px]" />
              )}
            </div>
          )}

          {message.type === 'DOCUMENT' && (
            <a
              href={message.mediaUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs opacity-90 hover:opacity-100 mb-1"
            >
              <FileText className="h-4 w-4" />
              <span>{message.content ?? 'Documento'}</span>
            </a>
          )}

          {message.content && message.type !== 'DOCUMENT' && (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          <div className={cn(
            'flex items-center gap-1 mt-1',
            message.fromMe ? 'justify-end' : 'justify-end'
          )}>
            <span className="text-[10px] opacity-60">
              {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.fromMe && StatusIcon && (
              <StatusIcon className={cn('h-3 w-3', message.status === 'READ' ? 'text-blue-300' : 'opacity-60')} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
