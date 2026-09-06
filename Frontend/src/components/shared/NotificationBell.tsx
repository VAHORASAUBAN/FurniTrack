import { useQuery } from '@tanstack/react-query'
import { Bell, Inbox } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { listNotifications } from '../../api/endpoints/notifications'
import { useFloatingMenu } from '../../hooks/useFloatingMenu'
import { absoluteTime, relativeTime } from '../../lib/time'

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

/** A shared activity feed, not a private inbox - any staff user posting,
 * paying, or confirming something writes one entry every other staff user
 * also sees (backend: app/services/notification_service.py). "Unread" is
 * tracked per-browser (the last notification id this tab has opened the
 * panel with), not per-user on the server, since the feed itself is shared.
 *
 * Renders through a portal (see useFloatingMenu) - a plain CSS `absolute`
 * panel here doesn't reliably paint above the rest of the page: any other
 * positioned element the panel happens to overlap (a Many2OneSelect
 * trigger inside a line-item grid, say) can still win the stacking order
 * and show through on top of it. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [lastSeenId, setLastSeenId] = useState(loadLastSeenId)
  const { triggerRef, menuRef, menuPosition } = useFloatingMenu({ open, onClose: () => setOpen(false), align: 'right' })
  const navigate = useNavigate()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(30),
    refetchInterval: 30_000,
  })

  const unreadCount = notifications.filter((n) => n.id > lastSeenId).length

  function handleOpen() {
    setOpen((o) => !o)
    if (notifications.length > 0) {
      const newest = notifications[0].id
      setLastSeenId(newest)
      persistLastSeenId(newest)
    }
  }

  return (
    <div ref={triggerRef} className="relative">
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

      {open &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right }}
            className="z-[60] w-80 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] shadow-lg"
          >
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
                  <span className="text-xs text-[var(--color-ink-3)]" title={absoluteTime(n.created_at)}>
                    {relativeTime(n.created_at)} · {absoluteTime(n.created_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
