import { Hammer } from 'lucide-react'

/** Placeholder for routes in the sidebar that haven't been built yet — the
 * nav shows the app's full intended shape from early on (per the build's
 * step-by-step, verify-as-you-go approach) without any route 404ing. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
      <Hammer size={28} className="text-[var(--color-ink-3)]" />
      <h1 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h1>
      <p className="text-sm text-[var(--color-ink-3)]">Not built yet — coming in a later step.</p>
    </div>
  )
}
