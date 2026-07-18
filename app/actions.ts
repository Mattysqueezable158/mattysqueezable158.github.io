import { createBrowserClientInstance, cleanUrl, cleanKey } from '@/lib/supabase'

const supabase = createBrowserClientInstance()

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface Flat {
  id: string
  block: string
  flat_no: string
}

export interface UserRow {
  id: string
  username: string
  password: string
  full_name: string | null
  role: 'admin' | 'user'
  flat_id: string | null
  active_device_id: string | null
  flats?: Flat | null
}

export interface UserProfile {
  id: string
  username: string
  full_name: string | null
  role: 'admin' | 'user'
  apartment_no: string
}

export interface MappedUser {
  id: string
  username: string
  full_name: string | null
  role: 'admin' | 'user'
  apartment_no: string
  block: string
  flat_no: string
  flat_id: string | null
}

export interface DoorRequest {
  id: string
  user_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  requested_by_email: string
  created_at: string
}

export interface ActionResult<T = undefined> {
  success: boolean
  error?: string
  data?: T
}

// ─── Env Test ────────────────────────────────────────────────────────────────

export async function adminTestEnv() {
  return {
    rawUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    rawKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cleanedUrl: cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanedKey: cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}

// ─── Session Local Helpers ────────────────────────────────────────────────────

function setSessionLocal(user: UserRow): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('haci_session_user', JSON.stringify(user))
  }
}

function updateSessionLocalField<K extends keyof UserRow>(field: K, value: UserRow[K]): void {
  if (typeof window !== 'undefined') {
    try {
      const user = JSON.parse(localStorage.getItem('haci_session_user') || '{}') as UserRow
      user[field] = value
      localStorage.setItem('haci_session_user', JSON.stringify(user))
    } catch (e) {
      console.error(e)
    }
  }
}

function getSessionLocal(): UserRow | null {
  if (typeof window === 'undefined') return null
  try {
    const userStr = localStorage.getItem('haci_session_user')
    return userStr ? (JSON.parse(userStr) as UserRow) : null
  } catch {
    return null
  }
}

function clearSessionLocal(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('haci_session_user')
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInAction(
  username: string,
  password: string,
  deviceId: string
): Promise<ActionResult> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .eq('password', password.trim())
      .single<UserRow>()

    if (error || !user) {
      return { success: false, error: 'Giriş hatası: Kullanıcı adı veya şifre hatalı.' }
    }

    if (deviceId) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ active_device_id: deviceId })
        .eq('id', user.id)
      if (updateError) console.error('Device ID update error:', updateError)
    }

    setSessionLocal(user)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function signOutAction(): Promise<ActionResult> {
  clearSessionLocal()
  return { success: true }
}

// ─── Mevcut Kullanıcı ─────────────────────────────────────────────────────────

export async function getCurrentUser(
  deviceId?: string
): Promise<ActionResult<{ user: UserRow; profile: UserProfile }>> {
  try {
    const localUser = getSessionLocal()
    if (!localUser) {
      return { success: false, error: 'Oturum bulunamadı.' }
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, flats(*)')
      .eq('id', localUser.id)
      .single<UserRow>()

    if (userError || !user) {
      clearSessionLocal()
      return { success: false, error: 'Kullanıcı bulunamadı.' }
    }

    if (deviceId && user.active_device_id && user.active_device_id !== deviceId) {
      clearSessionLocal()
      return { success: false, error: 'another_device' }
    }

    const profile: UserProfile = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      apartment_no: user.flats
        ? `${user.flats.block} Blok Daire ${user.flats.flat_no}`
        : 'Daire Tanımsız',
    }

    setSessionLocal(user)
    return { success: true, data: { user, profile } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Kapı Açma ────────────────────────────────────────────────────────────────

export async function triggerDoorOpen(
  deviceId: string
): Promise<ActionResult<{ requestId: string }>> {
  try {
    const userResult = await getCurrentUser(deviceId)
    if (!userResult.success || !userResult.data) {
      return { success: false, error: userResult.error }
    }

    const { user, profile } = userResult.data
    const label = profile.apartment_no
      ? `${profile.apartment_no} - ${profile.full_name || profile.username}`
      : profile.full_name || profile.username

    const { data, error } = await supabase
      .from('door_requests')
      .insert({
        user_id: user.id,
        status: 'pending',
        requested_by_email: label,
      })
      .select()
      .single<DoorRequest>()

    if (error || !data) {
      return { success: false, error: error?.message ?? 'Bilinmeyen hata' }
    }

    return { success: true, data: { requestId: data.id } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function checkRequestStatus(
  requestId: string
): Promise<ActionResult<{ status: DoorRequest['status'] }>> {
  try {
    const { data, error } = await supabase
      .from('door_requests')
      .select('status')
      .eq('id', requestId)
      .single<Pick<DoorRequest, 'status'>>()

    if (error || !data) {
      return { success: false, error: error?.message }
    }

    return { success: true, data: { status: data.status } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getDoorLogs(): Promise<ActionResult<DoorRequest[]>> {
  try {
    const { data, error } = await supabase
      .from('door_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: (data as DoorRequest[]) ?? [] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Admin: Kullanıcılar ──────────────────────────────────────────────────────

export async function adminGetUsers(): Promise<ActionResult<MappedUser[]>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, flats(*)')
      .order('username', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    const mappedUsers: MappedUser[] = (data as UserRow[]).map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      apartment_no: u.flats ? `${u.flats.block} Blok Daire ${u.flats.flat_no}` : '',
      block: u.flats ? u.flats.block : '',
      flat_no: u.flats ? u.flats.flat_no : '',
      flat_id: u.flat_id,
    }))

    return { success: true, data: mappedUsers }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function adminCreateUserAction(
  username: string,
  password: string,
  fullName: string,
  role: 'admin' | 'user' = 'user'
): Promise<ActionResult<UserRow>> {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        username: username.trim().toLowerCase(),
        password: password.trim(),
        full_name: fullName.trim(),
        role,
        flat_id: null,
      })
      .select()
      .single<UserRow>()

    if (userError || !user) {
      return { success: false, error: 'Kullanıcı oluşturulamadı: ' + (userError?.message ?? '') }
    }

    return { success: true, data: user }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function adminDeleteUserAction(userId: string): Promise<ActionResult> {
  try {
    const { error } = await supabase.from('users').delete().eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Admin: Daireler ──────────────────────────────────────────────────────────

export async function adminGetFlats(): Promise<ActionResult<Flat[]>> {
  try {
    const { data, error } = await supabase
      .from('flats')
      .select('*')
      .order('block', { ascending: true })
      .order('flat_no', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: (data as Flat[]) ?? [] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function adminCreateFlatAction(
  block: string,
  flatNo: string
): Promise<ActionResult<Flat>> {
  try {
    const { data, error } = await supabase
      .from('flats')
      .insert({
        block: block.trim().toUpperCase(),
        flat_no: flatNo.trim(),
      })
      .select()
      .single<Flat>()

    if (error || !data) {
      return { success: false, error: 'Daire oluşturulamadı: ' + (error?.message ?? '') }
    }

    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function adminLinkUserToFlatAction(
  userId: string,
  flatId: string | null
): Promise<ActionResult<UserRow>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ flat_id: flatId })
      .eq('id', userId)
      .select()
      .single<UserRow>()

    if (error || !data) {
      return { success: false, error: 'Eşleştirme başarısız: ' + (error?.message ?? '') }
    }

    const localUser = getSessionLocal()
    if (localUser && localUser.id === userId) {
      updateSessionLocalField('flat_id', flatId)
    }

    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─── Geofence ─────────────────────────────────────────────────────────────────

export interface GeofenceSettings {
  enabled: boolean
  lat: number
  lng: number
  radius_meters: number
}

export async function getGeofenceSettings(): Promise<ActionResult<GeofenceSettings>> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'geofence')
      .single<{ value: GeofenceSettings }>()

    if (error || !data) {
      // Kayıt yoksa varsayılan döndür
      return {
        success: true,
        data: { enabled: false, lat: 0, lng: 0, radius_meters: 100 },
      }
    }

    return { success: true, data: data.value }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function saveGeofenceSettings(
  settings: GeofenceSettings
): Promise<ActionResult> {
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'geofence', value: settings, updated_at: new Date().toISOString() })
      .eq('key', 'geofence')

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
