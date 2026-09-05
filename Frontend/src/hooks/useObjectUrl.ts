import { useEffect, useState } from 'react'

/** Live local preview for a File the user just picked but hasn't uploaded
 * yet (a new record has no id for the real upload endpoint to target
 * until it's saved) - revokes the previous object URL whenever `file`
 * changes or the component unmounts, so picking three photos in a row
 * doesn't leak three blob URLs. */
export function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return url
}
