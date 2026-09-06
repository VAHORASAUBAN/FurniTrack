import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export interface Many2OneOption {
  id: number
  label: string
}

interface Many2OneSelectProps {
  value: number | null | undefined
  onChange: (id: number | null) => void
  queryKey: string
  fetchOptions: (search: string) => Promise<Many2OneOption[]>
  placeholder?: string
  onCreateNew?: (label: string) => Promise<Many2OneOption>
  createLabel?: string
}

interface MenuRect {
  top: number
  left: number
  width: number
}

/** Design doc §7.4 — searchable async combobox for every Many2One field
 * (Product category, Chart of Account line, Journal default account, …),
 * with optional create-on-the-fly (the wireframe's note on Product Category:
 * "can be created and saved on the fly"). Filters to active records only —
 * archived ones never appear as a new selection (design doc §2.9).
 *
 * The dropdown itself renders through a portal into document.body,
 * positioned from the trigger's own bounding rect, rather than as a plain
 * `position: absolute` child. Every LineItemGrid row wraps this in a table
 * whose `overflow-x-auto` forces `overflow-y` to compute to `auto` too (a
 * CSS rule, not a bug in that component) - a plain absolute dropdown gets
 * trapped inside that scroll region instead of floating above the rest of
 * the form, which is what made the product picker look broken inside the
 * line-item grid specifically (every other Many2OneSelect usage has no
 * scrolling ancestor, so it never showed up there). */
export function Many2OneSelect({
  value,
  onChange,
  queryKey,
  fetchOptions,
  placeholder = 'Search…',
  onCreateNew,
  createLabel = 'Create',
}: Many2OneSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: options = [], isFetching } = useQuery({
    queryKey: [queryKey, 'm2o', debouncedSearch],
    queryFn: () => fetchOptions(debouncedSearch),
    enabled: open,
  })

  // Resolve the current value's label once (e.g. on edit-mode mount) by
  // finding it in an unfiltered options fetch, without keeping the dropdown open.
  const { data: allOptions } = useQuery({
    queryKey: [queryKey, 'm2o', ''],
    queryFn: () => fetchOptions(''),
  })
  useEffect(() => {
    if (value != null && allOptions) {
      const match = allOptions.find((o) => o.id === value)
      if (match) setSelectedLabel(match.label)
    } else if (value == null) {
      setSelectedLabel(null)
    }
  }, [value, allOptions])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = containerRef.current?.contains(target)
      const insideMenu = menuRef.current?.contains(target)
      if (!insideTrigger && !insideMenu) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    function updateRect() {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    updateRect()
    // capture:true - a LineItemGrid row's own horizontal scroll doesn't
    // bubble to window, only fires on ancestors in the capture phase.
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open])

  const exactMatchExists = options.some((o) => o.label.toLowerCase() === search.toLowerCase())

  async function handleCreate() {
    if (!onCreateNew || !search.trim()) return
    const created = await onCreateNew(search.trim())
    onChange(created.id)
    setSelectedLabel(created.label)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
      >
        <span className={selectedLabel ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-3)]'}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown size={15} className="text-[var(--color-ink-3)]" />
      </button>

      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuRect.top, left: menuRect.left, width: menuRect.width }}
            className="z-[60] rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] shadow-lg"
          >
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search…"
              className="w-full border-b border-[var(--color-rule)] px-3 py-2 text-sm outline-none"
            />
            <div className="max-h-56 overflow-y-auto">
              {isFetching && <div className="px-3 py-2 text-sm text-[var(--color-ink-3)]">Searching…</div>}
              {!isFetching && options.length === 0 && (
                <div className="px-3 py-2 text-sm text-[var(--color-ink-3)]">No matches.</div>
              )}
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id)
                    setSelectedLabel(opt.label)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-paper)]"
                >
                  {opt.label}
                  {value === opt.id && <Check size={14} className="text-[var(--color-accent)]" />}
                </button>
              ))}
              {onCreateNew && search.trim() && !exactMatchExists && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex w-full items-center gap-1.5 border-t border-[var(--color-rule)] px-3 py-2 text-left text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]"
                >
                  <Plus size={14} /> {createLabel} "{search.trim()}"
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
