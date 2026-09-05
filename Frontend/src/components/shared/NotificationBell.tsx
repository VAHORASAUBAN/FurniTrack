import { useQuery } from '@tanstack/react-query'
import { Bell, Inbox } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listNotifications } from '../../api/endpoints/notifications'

const STORAGE_KEY = 'uf_notifications_last_seen_id'

function loadLastSeenId(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) ?? '0') || 0
  } catch {
    return 0
  }
}

function persistLastSeenId(id: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // private-browsing / storage-blocked — the badge just won't persist across reloads
  }
}

function relativeTime(iso: string): string {
  // MySQL's NOW() (server_default on created_at) follows the DB server's
  // local time zone, not UTC, and the API echoes it back with no
  // zone/offset suffix - parsed as-is, that's local time on both ends.
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** A shared activity feed, not a private inbox - any staff user posting,
 * paying, or confirming something writes one entry every other staff user
 * also sees (backend: app/services/notification_service.py). "Unread" is
 * tracked per-browser (the last notification id this tab has opened the
 * panel with), not per-user on the server, since the feed itself is shared. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [lastSeenId, setLastSeenId] = useState(loadLastSeenId)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(30),
    refetchInterval: 30_000,
  })

  const unreadCount = notifications.filter((n) => n.id > lastSeenId).length

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleOpen() {
    setOpen((o) => !o)
    if (notifications.length > 0) {
      const newest = notifications[0].id
      setLastSeenId(newest)
      persistLastSeenId(newest)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        title="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] shadow-lg">
          <div className="border-b border-[var(--color-rule)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
            Activity
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Inbox size={18} className="text-[var(--color-ink-3)]" />
                <span className="text-sm text-[var(--color-ink-3)]">Nothing yet.</span>
              </div>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (n.link) navigate(n.link)
                }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--color-rule)] px-4 py-2.5 text-left last:border-0 hover:bg-[var(--color-paper-2)]"
              >
                <span className="text-sm text-[var(--color-ink)]">{n.message}</span>
                <span className="text-xs text-[var(--color-ink-3)]">{relativeTime(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
