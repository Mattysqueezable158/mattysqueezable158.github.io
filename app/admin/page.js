'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { adminGetUsers, adminCreateUserAction, adminDeleteUserAction, getCurrentUser } from '../actions'

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      let deviceId = localStorage.getItem('haci_device_id')
      if (!deviceId) {
        deviceId = crypto.randomUUID()
        localStorage.setItem('haci_device_id', deviceId)
      }
      const res = await getCurrentUser(deviceId)
      if (!res.success) {
        router.push('/login' + (res.error === 'another_device' ? '?reason=another_device' : ''))
        router.refresh()
      } else if (res.profile?.role !== 'admin') {
        router.push('/')
        router.refresh()
      }
    }
    checkSession()
  }, [router])
  
  // Form States
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [block, setBlock] = useState('')
  const [flatNo, setFlatNo] = useState('')
  const [role, setRole] = useState('user')
  
  const [formLoading, setFormLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' }) // error or success

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const result = await adminGetUsers()
    if (result.success) {
      setUsers(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setMessage({ text: '', type: '' })

    // Validate 6-digit numeric password
    if (!/^\d{6}$/.test(password)) {
      setMessage({ text: 'Şifre tam olarak 6 haneli ve sadece rakamlardan oluşmalıdır (örn: 125414)!', type: 'error' })
      setFormLoading(false)
      return
    }

    // Validate username is lowercase
    if (/[A-Z]/.test(username)) {
      setMessage({ text: 'Kullanıcı adı sadece küçük harflerden oluşmalıdır!', type: 'error' })
      setFormLoading(false)
      return
    }

    const result = await adminCreateUserAction(username, password, fullName, block, flatNo, role)
    if (result.success) {
      setMessage({ text: 'Kullanıcı başarıyla oluşturuldu.', type: 'success' })
      setUsername('')
      setPassword('')
      setFullName('')
      setBlock('')
      setFlatNo('')
      setRole('user')
      fetchUsers()
    } else {
      setMessage({ text: result.error || 'Kullanıcı oluşturulurken bir hata oluştu.', type: 'error' })
    }
    setFormLoading(false)
  }

  const handleDeleteUser = async (userId, userUsername) => {
    if (userUsername === 'admin') {
      alert('Süper admin hesabı silinemez!')
      return
    }
    
    if (!confirm('Bu kullanıcıyı tamamen silmek istediğinize emin misiniz?')) {
      return
    }

    const result = await adminDeleteUserAction(userId)
    if (result.success) {
      fetchUsers()
    } else {
      alert(result.error || 'Kullanıcı silinirken hata oluştu.')
    }
  }

  return (
    <div className="container space-y-6" style={{ padding: '40px 20px', minHeight: '100vh', maxWidth: '800px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="neon-text" style={{ fontSize: '1.4rem' }}>Hacıveyiszade</h2>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--accent-blue)', fontWeight: 600 }}>YÖNETİM PANELİ</p>
        </div>
        <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Kontrol Paneli &rarr;
        </Link>
      </div>

      {/* Kullanıcı Ekleme Formu */}
      <div className="glass-card" style={{ padding: '28px' }}>
        <h2 style={{ marginBottom: '20px' }}>Yeni Kullanıcı Tanımla</h2>

        {message.text && (
          <div className={`alert-box ${message.type}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label htmlFor="username">KULLANICI ADI</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="input-field"
                placeholder="örn: mehmet"
                required
                disabled={formLoading}
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">ŞİFRE (6 HANELİ SAYI)</label>
              <input
                id="password"
                type="text"
                pattern="[0-9]{6}"
                inputMode="numeric"
                maxLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                className="input-field"
                placeholder="örn: 125414"
                required
                disabled={formLoading}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label htmlFor="fullName">AD SOYAD</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                placeholder="örn: Mehmet Demir"
                required
                disabled={formLoading}
              />
            </div>
            <div className="input-group">
              <label htmlFor="block">BLOK</label>
              <input
                id="block"
                type="text"
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="input-field"
                placeholder="örn: A"
                required
                disabled={formLoading}
              />
            </div>
            <div className="input-group">
              <label htmlFor="flatNo">DAİRE NO</label>
              <input
                id="flatNo"
                type="text"
                value={flatNo}
                onChange={(e) => setFlatNo(e.target.value)}
                className="input-field"
                placeholder="örn: 4"
                required
                disabled={formLoading}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="role">KULLANICI YETKİSİ</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input-field"
              style={{ appearance: 'none', background: 'rgba(10, 10, 15, 0.8)' }}
              disabled={formLoading}
            >
              <option value="user">Normal Kullanıcı (Sadece kapı açabilir)</option>
              <option value="admin">Yönetici (Kullanıcı yönetebilir ve kapı açabilir)</option>
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '16px' }} disabled={formLoading}>
            {formLoading ? 'KULLANICI KAYDEDİLİYOR...' : 'KULLANICI EKLE'}
          </button>
        </form>
      </div>

      {/* Kullanıcı Listesi */}
      <div className="glass-card" style={{ padding: '28px' }}>
        <h2 style={{ marginBottom: '20px' }}>Kayıtlı Hesaplar</h2>

        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Kullanıcı Adı</th>
                <th>Ad Soyad</th>
                <th>Daire / Blok</th>
                <th>Yetki</th>
                <th style={{ textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{ color: 'var(--text-secondary)', padding: '20px' }}>
                    Yükleniyor...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{ color: 'var(--text-secondary)', padding: '20px' }}>
                    Henüz kayıtlı kullanıcı bulunmuyor.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{u.username}</span>
                    </td>
                    <td>{u.full_name || '-'}</td>
                    <td>{u.apartment_no || '-'}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'completed' : 'pending'}`}>
                        {u.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        className="btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          borderColor: u.username === 'admin' ? 'transparent' : 'rgba(255, 51, 102, 0.3)',
                          color: u.username === 'admin' ? 'var(--text-secondary)' : '#ff809b',
                          cursor: u.username === 'admin' ? 'not-allowed' : 'pointer'
                        }}
                        disabled={u.username === 'admin'}
                      >
                        Sil
                      </button>
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
