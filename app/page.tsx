'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PullToRefresh from '@/components/PullToRefresh'
import {
  triggerDoorOpen, checkRequestStatus, getDoorLogs,
  getCurrentUser, signOutAction,
  type UserProfile, type DoorRequest,
} from './actions'

type DoorStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'cooldown' | 'failed'

export default function Home() {
  const [status, setStatus]               = useState<DoorStatus>('idle')
  const [cooldownTime, setCooldownTime]   = useState(15)
  const [logs, setLogs]                   = useState<DoorRequest[]>([])
  const [loadingLogs, setLoadingLogs]     = useState(true)
  const [currentRequest, setCurrentRequest] = useState<string | null>(null)
  const [profile, setProfile]             = useState<UserProfile | null>(null)
  const router = useRouter()

  // Profil çek
  const fetchProfile = useCallback(async () => {
    let deviceId = localStorage.getItem('haci_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('haci_device_id', deviceId)
    }
    const result = await getCurrentUser(deviceId)
    if (result.success && result.data) {
      setProfile(result.data.profile)
    } else {
      router.push('/login' + (result.error === 'another_device' ? '?reason=another_device' : ''))
      router.refresh()
    }
  }, [router])

  // Logları çek
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    const result = await getDoorLogs()
    if (result.success && result.data) setLogs(result.data)
    setLoadingLogs(false)
  }, [])

  // Tüm veriyi yenile (pull-to-refresh için)
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchProfile(), fetchLogs()])
  }, [fetchProfile, fetchLogs])

  useEffect(() => {
    fetchProfile()
    fetchLogs()
  }, [fetchProfile, fetchLogs])

  // İstek durumu polling
  useEffect(() => {
    if (!currentRequest) return
    let pollInterval: ReturnType<typeof setInterval>
    let timeoutId: ReturnType<typeof setTimeout>

    const poll = async () => {
      const result = await checkRequestStatus(currentRequest)
      if (!result.success || !result.data) return
      const s = result.data.status
      if (s === 'processing') {
        setStatus('processing')
      } else if (s === 'completed') {
        clearInterval(pollInterval)
        setStatus('completed')
        fetchLogs()
        timeoutId = setTimeout(() => {
          setStatus('cooldown')
          setCooldownTime(15)
          setCurrentRequest(null)
        }, 2000)
      } else if (s === 'failed') {
        clearInterval(pollInterval)
        setStatus('failed')
        fetchLogs()
        timeoutId = setTimeout(() => { setStatus('idle'); setCurrentRequest(null) }, 4000)
      }
    }

    pollInterval = setInterval(poll, 1000)
    const safetyTimeout = setTimeout(() => {
      clearInterval(pollInterval)
      if (status === 'pending' || status === 'processing') {
        setStatus('failed')
        timeoutId = setTimeout(() => { setStatus('idle'); setCurrentRequest(null) }, 4000)
      }
    }, 15000)

    return () => { clearInterval(pollInterval); clearTimeout(timeoutId); clearTimeout(safetyTimeout) }
  }, [currentRequest, fetchLogs, status])

  // Cooldown geri sayım
  useEffect(() => {
    if (status !== 'cooldown') return
    if (cooldownTime <= 0) { setStatus('idle'); return }
    const timer = setTimeout(() => setCooldownTime((p) => p - 1), 1000)
    return () => clearTimeout(timer)
  }, [status, cooldownTime])

  // Kapı aç
  const handleOpenDoor = async () => {
    if (status !== 'idle') return
    setStatus('pending')
    let deviceId = localStorage.getItem('haci_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('haci_device_id', deviceId)
    }
    const result = await triggerDoorOpen(deviceId)
    if (result.success && result.data) {
      setCurrentRequest(result.data.requestId)
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

  // Çıkış
  const handleLogout = async () => {
    await signOutAction()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* PWA Pull-to-Refresh */}
      <PullToRefresh onRefresh={refreshAll} />

      <div className="container space-y-6" style={{
        padding: '24px 20px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        {/* Header */}
        <div className="glass-card admin-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="neon-text" style={{ fontSize: '1.3rem' }}>Hacıveyiszade</h2>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--accent-blue)', fontWeight: 600, marginTop: '2px' }}>
              {profile
                ? `${profile.apartment_no || 'Daire Tanımsız'} · ${profile.full_name || profile.username}`
                : 'Yükleniyor...'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {profile?.role === 'admin' && (
              <Link href="/admin" className="btn-secondary" style={{
                textDecoration: 'none', background: 'rgba(0,242,254,0.08)',
                borderColor: 'rgba(0,242,254,0.25)', color: 'var(--accent-blue)',
                fontSize: '0.8rem', padding: '8px 12px',
              }}>
                Yönetim
              </Link>
            )}
            <button onClick={handleLogout} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
              Çıkış
            </button>
          </div>
        </div>

        {/* Kapı Kontrol Kartı */}
        <div className="glass-card text-center" style={{ padding: '32px 20px' }}>
          <h2 style={{ marginBottom: '8px' }}>Kapı Kontrolü</h2>
          <p style={{ minHeight: '22px', fontSize: '0.9rem' }}>
            {status === 'idle'       && 'Kapı kapalı ve hazır.'}
            {status === 'pending'    && 'Açma isteği iletildi, ESP32 bekleniyor...'}
            {status === 'processing' && 'ESP32 tetiklendi, kapı açılıyor...'}
            {status === 'completed'  && 'Kapı açıldı! Giriş yapabilirsiniz.'}
            {status === 'cooldown'   && `Güvenlik koruması aktif. Bekleyin (${cooldownTime}s)`}
            {status === 'failed'     && 'Hata! ESP32-S3 ile bağlantı kurulamadı.'}
          </p>

          <div className="door-button-container">
            <div className="orbit-ring" />
            <div className={`orbit-ring-inner ${(status === 'pending' || status === 'processing') ? 'active' : ''}`} />
            <button
              onClick={handleOpenDoor}
              disabled={status !== 'idle'}
              className={`door-btn ${status}`}
              style={{ cursor: status === 'idle' ? 'pointer' : 'not-allowed' }}
            >
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginBottom: '8px' }}>
                {status === 'completed' ? (
                  <>
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </>
                )}
              </svg>
              <span>
                {status === 'idle'       && 'KAPIYI AÇ'}
                {status === 'pending'    && 'BEKLEYİN'}
                {status === 'processing' && 'AÇILIYOR'}
                {status === 'completed'  && 'AÇILDI'}
                {status === 'cooldown'   && `${cooldownTime}sn`}
                {status === 'failed'     && 'HATA'}
              </span>
            </button>
          </div>
        </div>

        {/* Geçiş Logları */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div className="logs-title-container">
            <h2 style={{ fontSize: '1.1rem' }}>Geçiş Günlükleri</h2>
            <button onClick={fetchLogs} className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }} disabled={loadingLogs}>
              {loadingLogs ? 'Yenileniyor...' : '↻ Yenile'}
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
                    <td colSpan={3} className="text-center" style={{ color: 'var(--text-secondary)', padding: '20px' }}>
                      {loadingLogs ? 'Yükleniyor...' : 'Henüz kayıt yok.'}
                    </td>
                  </tr>
                ) : logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{log.requested_by_email || 'Ziyaretçi'}</span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {new Date(log.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td>
                      <span className={`badge ${log.status}`}>
                        {log.status === 'pending'    && 'Bekliyor'}
                        {log.status === 'processing' && 'İşleniyor'}
                        {log.status === 'completed'  && 'Açıldı'}
                        {log.status === 'failed'     && 'Başarısız'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.15)', paddingBottom: '8px' }}>
          Hacıveyiszade Otomatik Kapı © {new Date().getFullYear()}
        </p>
      </div>
    </>
  )
}
