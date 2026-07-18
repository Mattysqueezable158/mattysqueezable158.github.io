'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInAction } from '../actions'

function LoginContent() {
  const [username, setUsername]           = useState('')
  const [password, setPassword]           = useState('')
  const [error, setError]                 = useState('')
  const [sessionWarning, setSessionWarning] = useState('')
  const [loading, setLoading]             = useState(false)
  const router      = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('reason') === 'another_device') {
      setSessionWarning('Bu hesaba başka bir cihazdan giriş yapıldı. Güvenliğiniz için bu cihazdaki oturum sonlandırıldı.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSessionWarning('')
    setLoading(true)

    let deviceId = localStorage.getItem('haci_device_id')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('haci_device_id', deviceId)
    }

    const result = await signInAction(username, password, deviceId)
    if (result.success) {
      router.push('/')
      router.refresh()
    } else {
      setError(result.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.')
      setLoading(false)
    }
  }

  return (
    <div className="container flex-center" style={{ minHeight: '100vh' }}>
      <div className="glass-card space-y-6" style={{ padding: '36px 28px', width: '100%' }}>

        {/* Başlık */}
        <div className="text-center space-y-4">
          <h1 className="neon-text" style={{ fontSize: '2rem' }}>Hacıveyiszade</h1>
          <p style={{
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-blue)',
          }}>
            OTOMATİK KAPI SİSTEMİ
          </p>
        </div>

        {/* Cihaz uyarısı */}
        {sessionWarning && (
          <div className="alert-box error" style={{
            background: 'rgba(255,178,54,0.1)',
            borderColor: 'rgba(255,178,54,0.3)',
            color: '#ffb236',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{sessionWarning}</span>
          </div>
        )}

        {/* Hata */}
        {error && (
          <div className="alert-box error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="input-group">
            <label htmlFor="username">KULLANICI ADI</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
              className="input-field"
              placeholder="kullanici"
              required
              disabled={loading}
              autoComplete="username"
              autoCapitalize="none"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">ŞİFRE (6 HANELİ SAYI)</label>
            <input
              id="password"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
              className="input-field"
              placeholder="••••••"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: '20px' }}
            disabled={loading}
          >
            {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Hacıveyiszade Otomatik Kapı &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="container flex-center" style={{ minHeight: '100vh', color: '#fff' }}>
        Yükleniyor...
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
