import { createBrowserClient } from '@supabase/ssr'

// Tırnak işaretlerini ve kaçış karakterlerini temizleyen yardımcı fonksiyonlar
export const cleanUrl = (val?: string): string => {
  const match = val?.match(/(https?:\/\/[^\s"'\\]+)/)
  return match ? match[1] : (val ?? '')
}

export const cleanKey = (val?: string): string => {
  // Legacy JWT-based anon key
  const match = val?.match(/([a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+)/)
  if (match) return match[0]

  // Modern publishable key
  const publishableMatch = val?.match(/(sb_publishable_[a-zA-Z0-9_\-]+)/)
  return publishableMatch ? publishableMatch[0] : (val ?? '')
}

// Client Component'ler için Browser İstemcisi
export function createBrowserClientInstance() {
  const url = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xfqdjpwczublqdlfhgfm.supabase.co')
  const key = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_HyQPokuWKv78IrqiCDGDsQ_O6W0hGqD')

  return createBrowserClient(url, key)
}
