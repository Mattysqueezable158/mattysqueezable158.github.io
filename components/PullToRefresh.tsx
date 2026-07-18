'use client'

import { useEffect, useRef, useCallback } from 'react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
}

/**
 * Swipe-to-refresh (pull-to-refresh) bileşeni.
 * PWA standalone modunda iOS/Android'de native yenileme olmadığından
 * parmakla aşağı çekince sayfayı/veriyi yeniler.
 */
export default function PullToRefresh({ onRefresh }: PullToRefreshProps) {
  const indicatorRef = useRef<HTMLDivElement>(null)
  const startYRef    = useRef<number>(0)
  const pullingRef   = useRef<boolean>(false)
  const refreshingRef = useRef<boolean>(false)
  const THRESHOLD    = 80 // px

  const showIndicator = useCallback((show: boolean) => {
    indicatorRef.current?.classList.toggle('ptr-visible', show)
  }, [])

  useEffect(() => {
    const el = document.documentElement

    const onTouchStart = (e: TouchEvent) => {
      // Yalnızca sayfanın en üstündeyken çalış
      if (el.scrollTop > 0) return
      startYRef.current  = e.touches[0].clientY
      pullingRef.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return
      const delta = e.touches[0].clientY - startYRef.current
      if (delta > 10) showIndicator(true)
    }

    const onTouchEnd = async (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return
      pullingRef.current = false

      const delta = e.changedTouches[0].clientY - startYRef.current
      if (delta < THRESHOLD) {
        showIndicator(false)
        return
      }

      refreshingRef.current = true
      try {
        await onRefresh()
      } finally {
        refreshingRef.current = false
        showIndicator(false)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onRefresh, showIndicator])

  return (
    <div ref={indicatorRef} className="ptr-indicator" aria-hidden>
      <div className="ptr-spinner" />
      <span>Yenileniyor...</span>
    </div>
  )
}
