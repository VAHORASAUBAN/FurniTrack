import { ImagePlus, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { API_ORIGIN } from '../../api/client'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

interface ImageUploadFieldProps {
  imageUrl: string | null
  /** Hits the module's own `POST .../{id}/image` endpoint - the caller
   * owns which one, this component only owns the picker/preview/validation. */
  onUpload: (file: File) => Promise<{ image_url?: string; profile_image_url?: string }>
  onUploaded: (url: string) => void
  disabled?: boolean
  label?: string
  shape?: 'circle' | 'square'
}

/** Shared by Contact and Product forms - design doc §5.3's
 * `POST /contacts/{id}/image` (and its Product mirror) already existed on
 * the backend with nothing on the frontend to call it. */
export function ImageUploadField({
  imageUrl,
  onUpload,
  onUploaded,
  disabled,
  label = 'Photo',
  shape = 'square',
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setLocalError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError('Only JPEG, PNG, or WEBP images are allowed.')
      return
    }
    if (file.size > MAX_BYTES) {
      setLocalError('Image must be 2MB or smaller.')
      return
    }
    setIsUploading(true)
    try {
      const result = await onUpload(file)
      const url = result.image_url ?? result.profile_image_url
      if (url) onUploaded(url)
    } catch {
      setLocalError('Upload failed — please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        title={imageUrl ? 'Change photo' : 'Upload a photo'}
        className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-[var(--color-rule-2)] bg-[var(--color-paper)] text-[var(--color-ink-3)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${shapeClass}`}
      >
        {imageUrl ? (
          <img src={`${API_ORIGIN}${imageUrl}`} alt={label} className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={22} />
        )}
        {isUploading && (
          <span className={`absolute inset-0 flex items-center justify-center bg-black/40 text-white ${shapeClass}`}>
            <Loader2 size={18} className="animate-spin" />
          </span>
        )}
      </button>
      <div>
        <div className="text-sm font-medium text-[var(--color-ink)]">{imageUrl ? `Change ${label.toLowerCase()}` : `Upload a ${label.toLowerCase()}`}</div>
        <div className="text-xs text-[var(--color-ink-3)]">JPEG, PNG, or WEBP · up to 2MB</div>
        {localError && <div className="mt-1 text-xs text-[var(--color-danger)]">{localError}</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
