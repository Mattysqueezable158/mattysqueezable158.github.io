import { createBrowserClient } from '@supabase/ssr'

// Tırnak işaretlerini ve kaçış karakterlerini temizleyen yardımcı fonksiyonlar
export const cleanUrl = (val) => {
  const match = val?.match(/(https?:\/\/[^\s"'\\]+)/)
  return match ? match[1] : val
}

export const cleanKey = (val) => {
  const match = val?.match(/([a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+)/)
  return match ? match[0] : val
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
