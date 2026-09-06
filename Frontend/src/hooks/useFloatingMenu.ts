import { useEffect, useRef, useState } from 'react'

interface MenuPosition {
  top: number
  left?: number
  right?: number
  width?: number
}

interface UseFloatingMenuOptions {
  open: boolean
  onClose: () => void
  /** 'left' anchors the panel's left edge under the trigger and sizes it
   * to the trigger's own width (a combobox menu); 'right' anchors the
   * panel's right edge to the trigger's right edge instead, sized by the
   * panel's own CSS width (a notification/settings panel near a screen
   * edge, where the trigger is much narrower than the panel). */
  align?: 'left' | 'right'
}

/** Every dropdown/panel in the app (Many2OneSelect's option list, the
 * notification bell, the dashboard Customize menu) needs the same two
 * things: close on an outside click, and a position computed from the
 * trigger's actual screen coordinates rather than plain CSS
 * `position: absolute`. Plain absolute positioning only reads as "float
 * above everything" when nothing else on the page is also positioned;
 * combine it with a table's `overflow-x-auto` (which forces `overflow-y`
 * to compute to `auto` too - a CSS rule, not a bug) or with unrelated
 * positioned siblings elsewhere on the page, and it can end up clipped or
 * visually buried under other content instead. Pair this with
 * `createPortal(..., document.body)` at the call site so the panel
 * renders outside every ancestor's stacking/overflow context entirely. */
export function useFloatingMenu({ open, onClose, align = 'left' }: UseFloatingMenuOptions) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = triggerRef.current?.contains(target)
      const insideMenu = menuRef.current?.contains(target)
      if (!insideTrigger && !insideMenu) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition(
        align === 'right'
          ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
          : { top: rect.bottom + 4, left: rect.left, width: rect.width }
      )
    }
    updatePosition()
    // capture:true - a scrolling ancestor (a table's own horizontal
    // scrollbar, a modal body) doesn't bubble scroll to window, only
    // fires on ancestors in the capture phase.
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, align])

  return { triggerRef, menuRef, menuPosition }
}
