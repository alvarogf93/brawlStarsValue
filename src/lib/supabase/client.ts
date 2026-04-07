import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        // Bypass Web Locks API to prevent "lock was stolen" errors on mobile/PWA
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn(),
      },
    }
  )
  return client
}
