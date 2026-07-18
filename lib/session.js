import crypto from 'crypto'
import { cookies } from 'next/headers'

// Generate a stable key using a SHA256 hash of the Supabase Anon Key (which is always present in env)
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'haciveyiszade_fallback_secret_key_long_enough')
  .digest()

export function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(text) {
  try {
    const parts = text.split(':')
    if (parts.length < 2) return null
    const iv = Buffer.from(parts.shift(), 'hex')
    const encryptedText = Buffer.from(parts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (e) {
    return null
  }
}

export async function setSession(userId) {
  const cookieStore = await cookies()
  const token = encrypt(userId)
  cookieStore.set('haci_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  })
}

export async function getSessionUserId() {
  const cookieStore = await cookies()
  const cookie = cookieStore.get('haci_session')
  if (!cookie) return null
  return decrypt(cookie.value)
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.set('haci_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0 // Expire immediately
  })
}
