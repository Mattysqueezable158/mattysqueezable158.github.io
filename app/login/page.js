'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInAction, adminTestEnv } from '../actions'

function LoginContent() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sessionWarning, setSessionWarning] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'another_device') {
      setSessionWarning('Bu hesaba başka bir cihazdan giriş yapıldı. Güvenliğiniz için bu cihazdaki oturum sonlandırıldı.')
    }
  }, [searchParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSessionWarning('')
    setLoading(true)

    // Cihaza özel benzersiz bir ID oluşturup localStorage'a kaydediyoruz
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
      <div className="glass-card space-y-6" style={{ padding: '40px 32px', width: '100%' }}>
        <div className="text-center space-y-4">
          <h1 className="neon-text" style={{ fontSize: '2.2rem' }}>Hacıveyiszade</h1>
          <p style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
            OTOMATİK KAPI SİSTEMİ
          </p>
        </div>

        {sessionWarning && (
          <div className="alert-box error" style={{ background: 'rgba(255, 178, 54, 0.1)', borderColor: 'rgba(255, 178, 54, 0.3)', color: '#ffb236' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>{sessionWarning}</span>
          </div>
        )}

        {error && (
          <div className="alert-box error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="input-group">
            <label htmlFor="username">KULLANICI ADI</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="kullanici"
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">ŞİFRE</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '24px' }} disabled={loading}>
            {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
          </button>
        </form>

        <div className="text-center" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Hacıveyiszade Otomatik Kapı &copy; {new Date().getFullYear()}
        </div>
        <div className="text-center">
          <button 
            type="button" 
            id="test-env-btn"
            onClick={async () => {
              const res = await adminTestEnv()
              alert(JSON.stringify(res))
            }}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', cursor: 'pointer', marginTop: '10px' }}
          >
            Sistem Değişkenlerini Test Et
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={<div className="container flex-center" style={{ minHeight: '100vh', color: '#fff' }}>Yükleniyor...</div>}>
      <LoginContent />
    </Suspense>
  )
}

