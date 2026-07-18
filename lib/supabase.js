import { createServerClient, createBrowserClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Tırnak işaretlerini ve kaçış karakterlerini temizleyen yardımcı fonksiyonlar
export const cleanUrl = (val) => {
  const match = val?.match(/(https?:\/\/[^\s"'\\]+)/)
  return match ? match[1] : val
}

export const cleanKey = (val) => {
  const match = val?.match(/([a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+)/)
  return match ? match[0] : val
}

// Server Components, Server Actions ve Route Handler'lar için Supabase İstemcisi
export async function createClient() {
  const cookieStore = await cookies()
  const url = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  console.log('CLEANED SUPABASE URL:', JSON.stringify(url))
  console.log('CLEANED SUPABASE KEY:', JSON.stringify(key))

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component'lerden çağrıldığında setAll hata verebilir,
            // middleware oturumu yenilediği için bu hata gözardı edilebilir.
          }
        },
      },
    }
  )
}

// Client Component'ler için Browser İstemcisi
export function createBrowserClientInstance() {
  const url = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return createBrowserClient(
    url,
    key
  )
}
