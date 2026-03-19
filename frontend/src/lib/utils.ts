import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '0%'
  return `${value.toFixed(decimals)}%`
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''

  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr

  if (isToday(date)) {
    return format(date, 'HH:mm')
  }

  if (isYesterday(date)) {
    return 'ontem'
  }

  return formatDistanceToNow(date, { addSuffix: false, locale: ptBR })
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function getAttainmentColor(attainment: number): string {
  if (attainment >= 100) return 'text-green-600'
  if (attainment >= 70) return 'text-amber-600'
  return 'text-red-600'
}

export function getAttainmentBg(attainment: number): string {
  if (attainment >= 100) return 'bg-green-100'
  if (attainment >= 70) return 'bg-amber-100'
  return 'bg-red-100'
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
