import { useEffect, useState } from 'react'

/** Delays reflecting `value` until it's stopped changing for `delayMs` -
 * used to keep a search box's typing instant while the query it drives
 * (a list refetch, a combobox's option fetch) only fires once the user
 * actually pauses, instead of once per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}
