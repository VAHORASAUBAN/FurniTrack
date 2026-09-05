import { ImagePlus, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

interface ImageUploadFieldProps {
  /** Already resolved - either the real `${API_ORIGIN}${...}` URL for a
   * saved record's photo, or a local object URL (useObjectUrl) for one
   * just picked on a not-yet-saved record. This component doesn't care
   * which. */
  previewUrl: string | null
  /** Called once a picked file passes type/size validation. On a new
   * record (no id to upload to yet) the caller should just hold onto the
   * file and upload it after the record is created; on an existing one it
   * can upload immediately. */
  onFileSelected: (file: File) => void
  isUploading?: boolean
  disabled?: boolean
  label?: string
  shape?: 'circle' | 'square'
  helperText?: string
}

/** Shared by Contact and Product forms, for both creating a new record
 * (nothing to upload to yet - the picked file is held until save) and
 * editing an existing one (uploads immediately). */
export function ImageUploadField({
  previewUrl,
  onFileSelected,
  isUploading,
  disabled,
  label = 'Photo',
  shape = 'square',
  helperText,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  function handleFile(file: File) {
    setLocalError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError('Only JPEG, PNG, or WEBP images are allowed.')
      return
    }
    if (file.size > MAX_BYTES) {
      setLocalError('Image must be 2MB or smaller.')
      return
    }
    onFileSelected(file)
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        title={previewUrl ? 'Change photo' : 'Upload a photo'}
        className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-[var(--color-rule-2)] bg-[var(--color-paper)] text-[var(--color-ink-3)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${shapeClass}`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
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
        <div className="text-sm font-medium text-[var(--color-ink)]">
          {previewUrl ? `Change ${label.toLowerCase()}` : `Upload a ${label.toLowerCase()}`}
        </div>
        <div className="text-xs text-[var(--color-ink-3)]">{helperText ?? 'JPEG, PNG, or WEBP · up to 2MB'}</div>
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
