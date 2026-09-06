/** MySQL's NOW() (every server_default on a created_at/updated_at column)
 * follows the DB server's local time zone, not UTC, and the API echoes it
 * back with no zone/offset suffix - parsed as-is, that's local time on
 * both ends, so plain `new Date(iso)` (no "Z" appended) is correct here. */
export function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Full local date + time, for a title/tooltip alongside the relative form. */
export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
