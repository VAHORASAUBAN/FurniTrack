import { useNavigate } from 'react-router-dom'

/** "Back" on a form/detail page should return to the list exactly as the
 * user left it - its search/sort/filters/page all live in the URL now
 * (ListView.tsx), which only survives a real browser-history pop, not a
 * fresh push to the bare list path. `fallbackPath` covers the one case
 * history can't: the page was opened directly (a refreshed tab, a pasted
 * link) with no in-app entry above it to go back to. */
export function useGoBack(fallbackPath: string): () => void {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
    } else {
      navigate(fallbackPath)
    }
  }
}
