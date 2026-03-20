import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

// Chainable noop returned when Supabase env vars are absent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeNoopChannel(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch: Record<string, any> = {
    subscribe: () => ({ unsubscribe: () => {} }),
  }
  ch['on'] = () => ch
  return ch
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase()
    if (!client) {
      if (prop === 'channel') return () => makeNoopChannel()
      if (prop === 'removeChannel') return () => Promise.resolve()
      return () => {}
    }
    return (client as unknown as Record<string | symbol, unknown>)[prop]
  },
})
