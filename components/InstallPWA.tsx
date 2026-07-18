'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible]   = useState(false)
  const [iosHint, setIosHint]   = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isStandalone()) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBip)

    // iOS: native prompt yok → paylaş menüsü ipucu göster
    if (isIos()) setVisible(true)

    const onInstalled = () => {
      setDeferred(null)
      setVisible(false)
      setIosHint(false)
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible) return null

  const handleClick = async () => {
    if (deferred) {
      setInstalling(true)
      try {
        await deferred.prompt()
        const { outcome } = await deferred.userChoice
        if (outcome === 'accepted') {
          setVisible(false)
          setDeferred(null)
        }
      } finally {
        setInstalling(false)
      }
      return
    }

    // iOS veya prompt henüz gelmemiş
    if (isIos()) {
      setIosHint((v) => !v)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        className="btn-secondary"
        title="Uygulamayı yükle"
        style={{
          fontSize: '0.8rem',
          padding: '8px 12px',
          background: 'rgba(0,242,254,0.08)',
          borderColor: 'rgba(0,242,254,0.25)',
          color: 'var(--accent-blue)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {installing ? '...' : 'İndir'}
      </button>

      {iosHint && (
        <div
          role="dialog"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 50,
            width: 'min(260px, calc(100vw - 40px))',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(10,10,15,0.95)',
            border: '1px solid rgba(0,242,254,0.25)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          <div style={{ color: '#00f2fe', fontWeight: 600, marginBottom: '6px' }}>
            Ana ekrana ekle
          </div>
          Safari’de alt menüden{' '}
          <strong style={{ color: '#e2e8f0' }}>Paylaş</strong>
          {' '}→{' '}
          <strong style={{ color: '#e2e8f0' }}>Ana Ekrana Ekle</strong>
          ’ye dokunun.
          <button
            type="button"
            onClick={() => setIosHint(false)}
            style={{
              display: 'block',
              marginTop: '10px',
              width: '100%',
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Tamam
          </button>
        </div>
      )}
    </div>
  )
}
