import { createBrowserClientInstance, cleanUrl, cleanKey } from '@/lib/supabase'

const supabase = createBrowserClientInstance()

export async function adminTestEnv() {
  return {
    rawUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    rawKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cleanedUrl: cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanedKey: cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
}

// Session Local Helpers
function setSessionLocal(user) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('haci_session_user', JSON.stringify(user))
  }
}

function getSessionLocal() {
  if (typeof window === 'undefined') return null
  try {
    const userStr = localStorage.getItem('haci_session_user')
    return userStr ? JSON.parse(userStr) : null
  } catch (e) {
    return null
  }
}

function clearSessionLocal() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('haci_session_user')
  }
}

// Giriş Yapma (Cihaz ID tabanlı ve client-side)
export async function signInAction(username, password, deviceId) {
  try {
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
      const { error: updateError } = await supabase
        .from('users')
        .update({ active_device_id: deviceId })
        .eq('id', user.id)
      if (updateError) console.error('Device ID update error:', updateError)
    }

    // Oturumu client-side set et
    setSessionLocal(user)

    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Çıkış Yapma
export async function signOutAction() {
  clearSessionLocal()
  return { success: true }
}

// Mevcut Giriş Yapmış Kullanıcı ve Profil Bilgilerini Alma (Cihaz kontrolü ile)
export async function getCurrentUser(deviceId) {
  try {
    const localUser = getSessionLocal()
    if (!localUser) {
      return { success: false, error: 'Oturum bulunamadı.' }
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, flats(*)')
      .eq('id', localUser.id)
      .single()

    if (userError || !user) {
      clearSessionLocal()
      return { success: false, error: 'Kullanıcı bulunamadı.' }
    }

    // Başka bir cihazdan giriş yapılıp yapılmadığını doğrula
    if (deviceId && user.active_device_id && user.active_device_id !== deviceId) {
      clearSessionLocal()
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

    // Local storage'ı güncel tutuyoruz
    setSessionLocal(user)

    return { success: true, user, profile }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Kapıyı Açma İsteği Oluşturma
export async function triggerDoorOpen(deviceId) {
  try {
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

    return { success: true, requestId: data.id }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Belirli bir isteğin durumunu sorgulama
export async function checkRequestStatus(requestId) {
  try {
    const { data, error } = await supabase
      .from('door_requests')
      .select('status')
      .eq('id', requestId)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, status: data.status }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Son kapı açma geçmişini (logları) getirme
export async function getDoorLogs() {
  try {
    const { data, error } = await supabase
      .from('door_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// --- ADMIN PANELI AKSİYONLARI ---

// Tüm kullanıcıların listesini alma
export async function adminGetUsers() {
  try {
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
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Yeni kullanıcı oluşturma
export async function adminCreateUserAction(username, password, fullName, block, flatNo, role) {
  try {
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

    return { success: true, data: user }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Kullanıcı silme
export async function adminDeleteUserAction(userId) {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
