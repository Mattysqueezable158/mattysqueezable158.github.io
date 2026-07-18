'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker, Circle as LeafletCircle } from 'leaflet'

interface GeofenceMapProps {
  lat: number
  lng: number
  radius: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (radius: number) => void
}

export default function GeofenceMap({
  lat, lng, radius, onCenterChange, onRadiusChange,
}: GeofenceMapProps) {
  const mapRef        = useRef<LeafletMap | null>(null)
  const markerRef     = useRef<LeafletMarker | null>(null)
  const circleRef     = useRef<LeafletCircle | null>(null)
  const myDotRef      = useRef<LeafletMarker | null>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  // ─── Haritayı mount'ta oluştur ──────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    let cancelled = false

    // Leaflet CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link')
      link.rel  = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    import('leaflet').then((L) => {
      if (cancelled || mapRef.current || !containerRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Kaydedilmiş merkez varsa onu kullan, yoksa geçici olarak dünya merkezi
      const hasSaved = lat && lng && (lat !== 0 || lng !== 0)
      const initLat  = hasSaved ? lat : 0
      const initLng  = hasSaved ? lng : 0

      const map = L.map(containerRef.current!, {
        center: hasSaved ? [initLat, initLng] : [39.9, 32.8], // Türkiye merkezi varsayılan
        zoom: hasSaved ? 17 : 6,
        zoomControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map)

      // Geofence merkez işaretçisi (sürüklenebilir) — sadece kaydedilmiş konum varsa göster
      if (hasSaved) {
        const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map)
        markerRef.current = marker

        const circle = L.circle([initLat, initLng], {
          radius,
          color: '#00f2fe',
          fillColor: '#00f2fe',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6 4',
        }).addTo(map)
        circleRef.current = circle

        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          circle.setLatLng(pos)
          onCenterChange(
            Math.round(pos.lat * 1_000_000) / 1_000_000,
            Math.round(pos.lng * 1_000_000) / 1_000_000,
          )
        })
      }

      // Haritaya tıklama: merkezi taşı veya ilk kez oluştur
      map.on('click', (e) => {
        if (mapRef.current !== map) return
        const latlng = e.latlng
        if (!markerRef.current) {
          const marker = L.marker(latlng, { draggable: true }).addTo(map)
          markerRef.current = marker
          const circle = L.circle(latlng, {
            radius,
            color: '#00f2fe',
            fillColor: '#00f2fe',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '6 4',
          }).addTo(map)
          circleRef.current = circle

          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            circle.setLatLng(pos)
            onCenterChange(
              Math.round(pos.lat * 1_000_000) / 1_000_000,
              Math.round(pos.lng * 1_000_000) / 1_000_000,
            )
          })
        } else {
          markerRef.current.setLatLng(latlng)
          circleRef.current?.setLatLng(latlng)
        }
        onCenterChange(
          Math.round(latlng.lat * 1_000_000) / 1_000_000,
          Math.round(latlng.lng * 1_000_000) / 1_000_000,
        )
      })

      // ─── Anlık konuma git ──────────────────────────────────────────────
      if (navigator.geolocation) {
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // Map may have been removed (Strict Mode remount / unmount) before GPS returns
            if (cancelled || mapRef.current !== map) return

            const { latitude, longitude } = pos.coords
            setLocating(false)

            // Mavi nokta: kullanıcının gerçek konumu
            const myIcon = L.divIcon({
              className: 'geofence-my-location',
              html: `<div style="
                width:16px;height:16px;border-radius:50%;
                background:#4facfe;border:2px solid #fff;
                box-shadow:0 0 0 4px rgba(79,172,254,0.3);
              "></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })

            if (myDotRef.current) {
              myDotRef.current.setLatLng([latitude, longitude])
            } else {
              myDotRef.current = L.marker([latitude, longitude], {
                icon: myIcon,
                interactive: false,
                zIndexOffset: -100,
              })
                .addTo(map)
                .bindTooltip('📍 Anlık Konumunuz', { permanent: false, direction: 'top' })
            }

            // Eğer kaydedilmiş merkez yoksa, anlık konuma fly et
            if (!hasSaved) {
              map.flyTo([latitude, longitude], 17, { duration: 1.4 })
            } else {
              // Kaydedilmiş merkez varsa sadece animasyonsuz göster
              map.panTo([latitude, longitude])
            }
          },
          () => {
            if (cancelled || mapRef.current !== map) return
            setLocating(false)
            setLocError('Konum alınamadı.')
          },
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
        circleRef.current = null
        myDotRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Dışarıdan lat/lng değişince geofence markerını güncelle ─────────────
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return

    let cancelled = false

    import('leaflet').then((L) => {
      const map = mapRef.current
      if (cancelled || !map) return

      if (!markerRef.current) {
        // Marker yoksa oluştur
        const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
        markerRef.current = marker
        const circle = L.circle([lat, lng], {
          radius,
          color: '#00f2fe', fillColor: '#00f2fe', fillOpacity: 0.12,
          weight: 2, dashArray: '6 4',
        }).addTo(map)
        circleRef.current = circle

        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          circle.setLatLng(pos)
          onCenterChange(
            Math.round(pos.lat * 1_000_000) / 1_000_000,
            Math.round(pos.lng * 1_000_000) / 1_000_000,
          )
        })
      } else {
        markerRef.current.setLatLng([lat, lng])
        circleRef.current?.setLatLng([lat, lng])
      }
      map.panTo([lat, lng])
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  // ─── Yarıçap değişince çemberi güncelle ──────────────────────────────────
  useEffect(() => {
    circleRef.current?.setRadius(radius)
  }, [radius])

  // ─── "Anlık konuma git" butonu ────────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return
    setLocating(true)
    setLocError('')

    const map = mapRef.current

    import('leaflet').then((L) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mapRef.current !== map) return

          const { latitude, longitude } = pos.coords
          setLocating(false)

          const myIcon = L.divIcon({
            className: 'geofence-my-location',
            html: `<div style="
              width:16px;height:16px;border-radius:50%;
              background:#4facfe;border:2px solid #fff;
              box-shadow:0 0 0 4px rgba(79,172,254,0.3);
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })

          if (myDotRef.current) {
            myDotRef.current.setLatLng([latitude, longitude])
          } else {
            myDotRef.current = L.marker([latitude, longitude], {
              icon: myIcon, interactive: false, zIndexOffset: -100,
            }).addTo(map).bindTooltip('📍 Anlık Konumunuz', { permanent: false, direction: 'top' })
          }

          map.flyTo([latitude, longitude], 17, { duration: 1.2 })
        },
        () => {
          if (mapRef.current !== map) return
          setLocating(false)
          setLocError('Konum alınamadı. Tarayıcıdan izin verin.')
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }

  return (
    <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(0,242,254,0.2)' }}>
      {/* Harita */}
      <div ref={containerRef} className="geofence-map-canvas" style={{ height: '360px', width: '100%', background: '#0d1117' }} />

      {/* Üst: ipucu */}
      <div style={{
        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, pointerEvents: 'none',
        background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
        padding: '5px 12px', fontSize: '0.73rem', color: 'var(--text-secondary)',
        whiteSpace: 'nowrap', maxWidth: 'calc(100% - 110px)',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {locating ? '📡 Konum alınıyor...' : 'İşaretçiyi sürükle veya haritaya tıkla'}
      </div>

      {/* Sağ üst: "Anlık Konuma Git" butonu */}
      <button
        onClick={handleLocate}
        disabled={locating}
        title="Anlık konuma git"
        style={{
          position: 'absolute', top: '10px', right: '50px',
          zIndex: 1000,
          background: locating ? 'rgba(10,10,15,0.9)' : 'rgba(10,10,15,0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,242,254,0.35)',
          borderRadius: '8px',
          color: '#00f2fe',
          padding: '6px 10px',
          fontSize: '1rem',
          cursor: locating ? 'wait' : 'pointer',
          lineHeight: 1,
          transition: 'all 0.2s',
        }}
      >
        {locating ? '⌛' : '🎯'}
      </button>

      {/* Hata mesajı */}
      {locError && (
        <div style={{
          position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255,51,102,0.15)', border: '1px solid rgba(255,51,102,0.3)',
          borderRadius: '8px', padding: '6px 14px',
          fontSize: '0.78rem', color: '#ff809b',
          maxWidth: 'calc(100% - 24px)', textAlign: 'center',
        }}>
          {locError}
        </div>
      )}

      {/* Alt: yarıçap slider */}
      <div style={{
        position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,242,254,0.25)', borderRadius: '12px',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
        width: 'min(320px, calc(100% - 24px))',
      }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          ⭕ Yarıçap:
        </span>
        <input
          type="range" min={10} max={1000} step={5} value={radius}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#00f2fe', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00f2fe', minWidth: '52px', textAlign: 'right' }}>
          {radius} m
        </span>
      </div>
    </div>
  )
}
