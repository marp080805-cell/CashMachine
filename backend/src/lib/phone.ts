/**
 * Normaliza número de telefone brasileiro para formato padrão E.164 sem o +
 * Aceita qualquer formato que o SDR digitar:
 *   35997452928, (35)99745-2928, 035997452928, 5535997452928, +5535997452928
 * Resultado: 5535997452928 (com código do país 55 + DDD + número 9-dígito)
 *
 * Se não conseguir normalizar, retorna os dígitos brutos para não perder dados.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Remove tudo que não é dígito
  const digits = raw.replace(/\D/g, '')

  if (!digits) return null

  // Já tem código do país (55) + DDD + número
  if (digits.startsWith('55') && digits.length >= 12) {
    const local = digits.slice(2)

    // 10 dígitos: DDD + número sem o 9 (ex: 3597452928) → adiciona o 9
    if (local.length === 10) {
      return `55${local.slice(0, 2)}9${local.slice(2)}`
    }

    // 11 dígitos: DDD + 9 + número → já correto
    if (local.length === 11) {
      return digits
    }

    // Caso desconhecido — retorna como está
    return digits
  }

  // Começa com 0 (ex: 035997452928) → remove o 0
  const stripped = digits.startsWith('0') ? digits.slice(1) : digits

  // Sem código do país: DDD + número
  if (stripped.length === 10) {
    // DDD (2) + número 8-dígito → adiciona 9
    return `55${stripped.slice(0, 2)}9${stripped.slice(2)}`
  }

  if (stripped.length === 11) {
    // DDD (2) + 9 + número 8-dígito → já correto
    return `55${stripped}`
  }

  // Não reconhecido — retorna os dígitos sem formatar
  return digits
}

/**
 * Gera variantes 9-dígito/8-dígito para lookup tolerante no banco
 */
export function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone)
  if (!normalized) return phone ? [phone.replace(/\D/g, '')] : []

  const variants = new Set([normalized])

  if (normalized.startsWith('55') && normalized.length >= 12) {
    const local = normalized.slice(2)

    // Com 9 → também tenta sem o 9
    if (local.length === 11 && local[2] === '9') {
      variants.add(`55${local.slice(0, 2)}${local.slice(3)}`)
    }

    // Sem 9 → também tenta com o 9
    if (local.length === 10) {
      variants.add(`55${local.slice(0, 2)}9${local.slice(2)}`)
    }
  }

  return [...variants]
}
