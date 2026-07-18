'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { triggerDoorOpen, checkRequestStatus, getDoorLogs, getCurrentUser, signOutAction } from './actions'

export default function Home() {
  const [status, setStatus] = useState('idle') // idle, pending, processing, completed, cooldown, failed
  const [cooldownTime, setCooldownTime] = useState(15)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [currentRequest, setCurrentRequest] = useState(null)
  
  // Kullanıcı profili state'i
  const [profile, setProfile] = useState(null)
  const router = useRouter()

  // Kullanıcı profil bilgilerini çekme
  const fetchProfile = useCallback(async () => {
    let deviceId = localStorage.getItem('haci_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('haci_device_id', deviceId)
    }

    const result = await getCurrentUser(deviceId)
    if (result.success) {
      setProfile(result.profile)
    } else {
      router.push('/login' + (result.error === 'another_device' ? '?reason=another_device' : ''))
      router.refresh()
    }
  }, [router])

  // Son işlemleri veritabanından çekme
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    const result = await getDoorLogs()
    if (result.success) {
      setLogs(result.data)
    }
    setLoadingLogs(false)
  }, [])

  // Sayfa yüklendiğinde profil ve logları çek (Otomatik yenileme kaldırıldı)
  useEffect(() => {
    fetchProfile()
    fetchLogs()
  }, [fetchProfile, fetchLogs])

  // Kapı açma isteğinin durumunu izleme (polling)
  useEffect(() => {
    if (!currentRequest) return

    let pollInterval
    let timeoutId

    const poll = async () => {
      const result = await checkRequestStatus(currentRequest)
      if (result.success) {
        // Durum 'processing' olduysa (ESP32 isteği aldıysa)
        if (result.status === 'processing') {
          setStatus('processing')
        } 
        // Durum 'completed' olduysa (ESP32 kapıyı açıp pini sıfırladıysa)
        else if (result.status === 'completed') {
          clearInterval(pollInterval)
          setStatus('completed')
          fetchLogs()
          
          // 2 saniye 'AÇILDI' durumunda kaldıktan sonra 15 saniyelik spam korumasına (cooldown) geç
          timeoutId = setTimeout(() => {
            setStatus('cooldown')
            setCooldownTime(15)
            setCurrentRequest(null)
          }, 2000)
        } 
        // Durum 'failed' olduysa
        else if (result.status === 'failed') {
          clearInterval(pollInterval)
          setStatus('failed')
          fetchLogs()
          timeoutId = setTimeout(() => {
            setStatus('idle')
            setCurrentRequest(null)
          }, 4000)
        }
      }
    }

    // Her saniye veritabanını sorgula
    pollInterval = setInterval(poll, 1000)

    // Güvenlik zaman aşımı: ESP32-S3 15 saniye içinde cevap vermezse isteği hata durumuna çek
    const safetyTimeout = setTimeout(() => {
      clearInterval(pollInterval)
      if (status === 'pending' || status === 'processing') {
        setStatus('failed')
        timeoutId = setTimeout(() => {
          setStatus('idle')
          setCurrentRequest(null)
        }, 4000)
      }
    }, 15000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeoutId)
      clearTimeout(safetyTimeout)
    }
  }, [currentRequest, fetchLogs, status])

  // 15 Saniyelik Geri Sayım Sayacı (Cooldown)
  useEffect(() => {
    if (status !== 'cooldown') return

    if (cooldownTime <= 0) {
      setStatus('idle')
      return
    }

    const timer = setTimeout(() => {
      setCooldownTime(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [status, cooldownTime])

  // Kapıyı açma isteğini tetikleme
  const handleOpenDoor = async () => {
    if (status !== 'idle') return

    setStatus('pending')
    
    let deviceId = localStorage.getItem('haci_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('haci_device_id', deviceId)
    }

    const result = await triggerDoorOpen(deviceId)

    if (result.success) {
      setCurrentRequest(result.requestId)
      fetchLogs()
    } else {
      setStatus('failed')
      if (result.error === 'another_device') {
        router.push('/login?reason=another_device')
        router.refresh()
      } else {
        alert(result.error || 'İstek gönderilirken hata oluştu.')
        setTimeout(() => setStatus('idle'), 3000)
      }
    }
  }

  // Çıkış yapma
  const handleLogout = async () => {
    await signOutAction()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="container space-y-6" style={{ padding: '40px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="neon-text" style={{ fontSize: '1.4rem' }}>Hacıveyiszade</h2>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--accent-blue)', fontWeight: 600 }}>
            {profile ? `${profile.apartment_no || 'Daire Tanımsız'} - ${profile.full_name || profile.username}` : 'Yükleniyor...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {profile?.role === 'admin' && (
            <Link href="/admin" className="btn-secondary" style={{ textDecoration: 'none', background: 'rgba(0, 242, 254, 0.1)', borderColor: 'rgba(0, 242, 254, 0.3)', color: 'var(--accent-blue)' }}>
              Yönetim Paneli
            </Link>
          )}
          <button onClick={handleLogout} className="btn-secondary">Çıkış Yap</button>
        </div>
      </div>

      {/* Kontrol Butonu Kartı */}
      <div className="glass-card text-center" style={{ padding: '40px 24px' }}>
        <h2 style={{ marginBottom: '10px' }}>Kapı Kontrolü</h2>
        <p style={{ minHeight: '24px', fontSize: '0.95rem' }}>
          {status === 'idle' && 'Kapı kapalı ve hazır.'}
          {status === 'pending' && 'Açma isteği iletildi, ESP32 bekleniyor...'}
          {status === 'processing' && 'ESP32 tetiklendi, kapı açılıyor...'}
          {status === 'completed' && 'Kapı açıldı! Giriş yapabilirsiniz.'}
          {status === 'cooldown' && `Güvenlik koruması aktif. Lütfen bekleyin (${cooldownTime}s)`}
          {status === 'failed' && 'Hata! ESP32-S3 ile bağlantı kurulamadı.'}
        </p>

        {/* Buton ve Yörünge Animasyonu */}
        <div className="door-button-container">
          <div className="orbit-ring"></div>
          <div className={`orbit-ring-inner ${(status === 'pending' || status === 'processing') ? 'active' : ''}`}></div>
          <button
            onClick={handleOpenDoor}
            disabled={status !== 'idle'}
            className={`door-btn ${status}`}
            style={{
              cursor: status === 'idle' ? 'pointer' : 'not-allowed'
            }}
          >
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginBottom: '8px' }}>
              {status === 'completed' ? (
                <>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor"></rect>
                </>
              ) : (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </>
              )}
            </svg>
            <span>
              {status === 'idle' && 'KAPIYI AÇ'}
              {status === 'pending' && 'BEKLEYİN'}
              {status === 'processing' && 'AÇILIYOR'}
              {status === 'completed' && 'AÇILDI'}
              {status === 'cooldown' && `${cooldownTime}sn`}
              {status === 'failed' && 'HATA'}
            </span>
          </button>
        </div>
      </div>

      {/* Loglar Bölümü */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div className="logs-title-container">
          <h2>Geçiş Günlükleri</h2>
          <button onClick={fetchLogs} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={loadingLogs}>
            {loadingLogs ? 'Yenileniyor...' : 'Yenile'}
          </button>
        </div>

        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Kullanıcı / Daire</th>
                <th>Tarih / Saat</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center" style={{ color: 'var(--text-secondary)', padding: '20px' }}>
                    {loadingLogs ? 'Yükleniyor...' : 'Henüz kapı açma kaydı bulunmuyor.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{log.requested_by_email || 'Ziyaretçi'}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {new Date(log.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td>
                      <span className={`badge ${log.status}`}>
                        {log.status === 'pending' && 'Bekliyor'}
                        {log.status === 'processing' && 'İşleniyor'}
                        {log.status === 'completed' && 'Açıldı'}
                        {log.status === 'failed' && 'Başarısız'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
