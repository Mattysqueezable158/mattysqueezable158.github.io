'use server'

import { createClient, cleanUrl, cleanKey } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { setSession, clearSession, getSessionUserId } from '@/lib/session'

export async function adminTestEnv() {
  return {
    rawUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    rawKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cleanedUrl: cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanedKey: cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}

// Giriş Yapma Server Action (Kullanıcı adı ve Cihaz ID tabanlı)
export async function signInAction(username, password, deviceId) {
  const supabase = await createClient()

  // Veritabanından kullanıcıyı sorgula
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .eq('password', password.trim())
    .single()

  if (error || !user) {
    return { success: false, error: 'Giriş hatası: Kullanıcı adı veya şifre hatalı.' }
  }

  // Cihaz ID'sini veritabanına kaydet
  if (deviceId) {
    await supabase
      .from('users')
      .update({ active_device_id: deviceId })
      .eq('id', user.id)
  }

  // Oturumu set et
  await setSession(user.id)

  return { success: true }
}

// Çıkış Yapma Server Action
export async function signOutAction() {
  await clearSession()
}

// Mevcut Giriş Yapmış Kullanıcı ve Profil Bilgilerini Alma (Cihaz kontrolü ile)
export async function getCurrentUser(deviceId) {
  const userId = await getSessionUserId()
  if (!userId) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  const supabase = await createClient()

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*, flats(*)')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    return { success: false, error: 'Kullanıcı bulunamadı.' }
  }

  // Başka bir cihazdan giriş yapılıp yapılmadığını doğrula
  if (deviceId && user.active_device_id && user.active_device_id !== deviceId) {
    await clearSession()
    return { success: false, error: 'another_device' }
  }

  // Geriye dönük uyumluluk için profiles formatında map ediyoruz
  const profile = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    apartment_no: user.flats ? `${user.flats.block} Blok Daire ${user.flats.flat_no}` : 'Daire Tanımsız'
  }

  return { success: true, user, profile }
}

// Kapıyı Açma İsteği Oluşturma Server Action (Cihaz ID ile)
export async function triggerDoorOpen(deviceId) {
  const supabase = await createClient()
  
  // Oturum açmış kullanıcı ve profilini al (cihaz kontrolü ile)
  const userResult = await getCurrentUser(deviceId)
  if (!userResult.success) {
    return { success: false, error: userResult.error }
  }

  const { user, profile } = userResult
  const label = profile.apartment_no 
    ? `${profile.apartment_no} - ${profile.full_name || profile.username}` 
    : (profile.full_name || profile.username)

  // Yeni bir kapı açma isteği ekle (durum: 'pending')
  const { data, error } = await supabase
    .from('door_requests')
    .insert({
      user_id: user.id,
      status: 'pending',
      requested_by_email: label
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, requestId: data.id }
}

// Belirli bir isteğin durumunu sorgulama
export async function checkRequestStatus(requestId) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('door_requests')
    .select('status')
    .eq('id', requestId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, status: data.status }
}

// Son kapı açma geçmişini (logları) getirme
export async function getDoorLogs() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('door_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

// --- ADMIN PANELI AKSİYONLARI ---

// Tüm kullanıcıların listesini alma
export async function adminGetUsers() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('*, flats(*)')
    .order('username', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  // Geriye dönük uyumluluk için profiles formatında map ediyoruz
  const mappedUsers = data.map(u => ({
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    role: u.role,
    apartment_no: u.flats ? `${u.flats.block} Blok Daire ${u.flats.flat_no}` : '',
    block: u.flats ? u.flats.block : '',
    flat_no: u.flats ? u.flats.flat_no : '',
  }))

  return { success: true, data: mappedUsers }
}

// Yeni kullanıcı oluşturma
export async function adminCreateUserAction(username, password, fullName, block, flatNo, role) {
  const supabase = await createClient()

  // 1. Daireyi bul veya oluştur
  let flatId = null
  if (block && flatNo) {
    const { data: existingFlat } = await supabase
      .from('flats')
      .select('id')
      .eq('block', block.trim().toUpperCase())
      .eq('flat_no', flatNo.trim())
      .single()

    if (existingFlat) {
      flatId = existingFlat.id
    } else {
      const { data: newFlat, error: flatError } = await supabase
        .from('flats')
        .insert({
          block: block.trim().toUpperCase(),
          flat_no: flatNo.trim()
        })
        .select('id')
        .single()

      if (flatError) {
        return { success: false, error: 'Daire oluşturulamadı: ' + flatError.message }
      }
      flatId = newFlat.id
    }
  }

  // 2. Kullanıcıyı oluştur
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      username: username.trim().toLowerCase(),
      password: password.trim(),
      full_name: fullName.trim(),
      role: role,
      flat_id: flatId
    })
    .select()
    .single()

  if (userError) {
    return { success: false, error: 'Kullanıcı oluşturulamadı: ' + userError.message }
  }

  revalidatePath('/admin')
  return { success: true, data: user }
}

// Kullanıcı silme
export async function adminDeleteUserAction(userId) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

