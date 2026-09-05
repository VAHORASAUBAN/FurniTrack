import { Hammer } from 'lucide-react'

/** Placeholder for routes in the sidebar that haven't been built yet — the
 * nav shows the app's full intended shape from early on (per the build's
 * step-by-step, verify-as-you-go approach) without any route 404ing. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-28 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brass-bg)] text-[var(--color-brass)]">
        <Hammer size={24} />
      </div>
      <h1 className="font-display text-xl font-semibold text-[var(--color-ink)]">{title}</h1>
      <p className="max-w-xs text-sm text-[var(--color-ink-3)]">
        This screen is still being built out — check back in a later step of the rollout.
      </p>
    </div>
  )
}
