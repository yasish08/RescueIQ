import { useState, useEffect, useRef } from 'react'
import { FiBell } from 'react-icons/fi'

// Shared notification store — simple pub/sub so any component can push notifications
const _listeners = new Set()
let _notifications = []

export function pushNotification(message, type = 'info') {
  const n = { id: Date.now(), message, type, ts: new Date() }
  _notifications = [n, ..._notifications].slice(0, 20)
  _listeners.forEach(fn => fn([..._notifications]))
}

function useNotifications() {
  const [notes, setNotes] = useState([..._notifications])
  useEffect(() => {
    _listeners.add(setNotes)
    return () => _listeners.delete(setNotes)
  }, [])
  return notes
}

export default function NotificationBell() {
  const notes = useNotifications()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(0)
  const ref = useRef(null)

  const unseen = notes.length - seen

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    setOpen(v => !v)
    setSeen(notes.length)
  }

  const typeColor = { info: '#60a5fa', success: '#4ade80', warning: '#fbbf24', error: '#f87171' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{
        border: 'none', cursor: 'pointer', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 38, borderRadius: '50%',
        background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
        transition: 'background 0.2s',
      }}>
        <FiBell size={20} color={unseen > 0 ? '#f59e0b' : '#64748b'} />
        {unseen > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 16, height: 16, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: '0.6rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', right: '0.75rem', top: 'calc(env(safe-area-inset-top) + 3.25rem)', zIndex: 200,
          width: 'min(300px, calc(100vw - 1.5rem))', maxHeight: 'min(360px, calc(100vh - 5rem))', overflowY: 'auto',
          background: '#111827', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: '0.85rem' }}>
            Notifications
          </div>
          {notes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>
              No notifications yet
            </div>
          ) : (
            notes.map(n => (
              <div key={n.id} style={{
                padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                  background: typeColor[n.type] || '#60a5fa',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.5, wordBreak: 'break-word' }}>{n.message}</div>
                  <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 2 }}>
                    {n.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
