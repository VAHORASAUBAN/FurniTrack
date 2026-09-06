import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, type DefaultValues } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { API_ORIGIN, getApiErrorMessage } from '../../api/client'
import {
  archiveContact,
  createContact,
  getContact,
  unarchiveContact,
  updateContact,
  uploadContactImage,
} from '../../api/endpoints/contacts'
import { FormShell } from '../../components/shared/FormShell'
import { ImageUploadField } from '../../components/shared/ImageUploadField'
import { useGoBack } from '../../hooks/useGoBack'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { useAuthStore } from '../../stores/authStore'
import type { PortalCredentials } from '../../types/contact'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  contact_type: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']),
  email: z.union([z.literal(''), z.string().email('Enter a valid email')]).optional(),
  mobile: z.string().max(20).optional(),
  street: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  create_portal_user: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export function ContactFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const contactId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/contacts')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)
  const [issuedCredentials, setIssuedCredentials] = useState<PortalCredentials | null>(null)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const pendingImagePreview = useObjectUrl(pendingImageFile)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contacts', contactId],
    queryFn: () => getContact(contactId as number),
    enabled: !isNew,
  })

  // Hoisted so the Clear button can pass this same object to reset()
  // explicitly - react-hook-form's `values` option (below) silently
  // overwrites its internal defaultValues with the loaded record once
  // `contact` resolves, so a bare reset() on an edit page just reapplies
  // the currently-loaded record instead of blanking the form.
  const blankValues: DefaultValues<FormValues> = { contact_type: 'CUSTOMER', country: 'India' }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: contact
      ? {
          name: contact.name,
          contact_type: contact.contact_type,
          email: contact.email ?? '',
          mobile: contact.mobile ?? '',
          street: contact.street ?? '',
          city: contact.city ?? '',
          state: contact.state ?? '',
          country: contact.country ?? '',
          pincode: contact.pincode ?? '',
        }
      : undefined,
    defaultValues: blankValues,
  })

  const createMutation = useMutation({
    mutationFn: createContact,
    onSuccess: async (resp) => {
      if (pendingImageFile) {
        try {
          await uploadContactImage(resp.contact.id, pendingImageFile)
        } catch {
          // the axios interceptor already toasts the failure - the contact
          // itself still saved fine, so don't block navigation on this
        }
      }
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      if (resp.portal_credentials) {
        setIssuedCredentials(resp.portal_credentials)
      } else {
        navigate(`/contacts/${resp.contact.id}`, { replace: true })
      }
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (values: Partial<FormValues>) => updateContact(contactId as number, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contacts', contactId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const archiveMutation = useMutation({
    mutationFn: () => (contact?.is_active ? archiveContact(contactId as number) : unarchiveContact(contactId as number)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contacts', contactId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    const cleaned = { ...values, email: values.email || undefined }
    if (isNew) {
      createMutation.mutate(cleaned)
    } else {
      const { create_portal_user: _unused, ...rest } = cleaned
      updateMutation.mutate(rest)
    }
  }

  async function handleImageSelected(file: File) {
    // A new contact has no id for the upload endpoint to target yet - hold
    // the file and send it right after createMutation succeeds instead.
    if (isNew) {
      setPendingImageFile(file)
      return
    }
    setIsUploadingImage(true)
    try {
      await uploadContactImage(contactId as number, file)
      queryClient.invalidateQueries({ queryKey: ['contacts', contactId] })
    } finally {
      setIsUploadingImage(false)
    }
  }

  if (!isNew && isLoading) {
    return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>
  }

  const canArchive = role === 'ADMIN' && !isNew

  return (
    <FormShell
      title={isNew ? 'New Contact' : contact?.name ?? 'Contact'}
      status={!isNew && contact ? (contact.is_active ? 'ACTIVE' : 'ARCHIVED') : undefined}
      onBack={goBack}
      actions={[
        ...(canArchive
          ? [
              {
                label: contact?.is_active ? 'Archive' : 'Unarchive',
                onClick: () => archiveMutation.mutate(),
                variant: (contact?.is_active ? 'danger' : 'secondary') as 'danger' | 'secondary',
              },
            ]
          : []),
        {
          label: createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save',
          onClick: handleSubmit(onSubmit),
          variant: 'primary',
          disabled: createMutation.isPending || updateMutation.isPending,
        },
        { label: 'Clear', onClick: () => reset(blankValues), variant: 'secondary' },
      ]}
    >
      {issuedCredentials && (
        <div className="mb-5 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-bg)] p-4 text-sm">
          <p className="mb-2 font-semibold text-[var(--color-accent)]">Portal login created — relay these once</p>
          <p className="text-[var(--color-ink)]">
            Login ID: <code className="font-semibold">{issuedCredentials.login_id}</code>
          </p>
          <p className="text-[var(--color-ink)]">
            Temporary password: <code className="font-semibold">{issuedCredentials.temporary_password}</code>
          </p>
          <p className="mt-2 text-xs text-[var(--color-ink-2)]">
            This password is shown only once and cannot be retrieved again. The portal user
            will be required to set their own password the moment they log in with it.
          </p>
          <button
            onClick={() => navigate(`/contacts`)}
            className="mt-3 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white"
          >
            Done
          </button>
        </div>
      )}

      <div className="mb-5">
        <ImageUploadField
          previewUrl={pendingImagePreview ?? (contact?.profile_image_url ? `${API_ORIGIN}${contact.profile_image_url}` : null)}
          label="Photo"
          shape="circle"
          isUploading={isUploadingImage}
          helperText={isNew && pendingImageFile ? 'Will upload once you save' : undefined}
          onFileSelected={handleImageSelected}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Contact Name" error={errors.name?.message}>
          <input {...register('name')} className={inputClass} />
        </Field>

        <Field label="Type" error={errors.contact_type?.message}>
          <select {...register('contact_type')} className={inputClass}>
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
            <option value="BOTH">Customer & Vendor</option>
          </select>
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <input {...register('email')} className={inputClass} />
        </Field>

        <Field label="Phone" error={errors.mobile?.message}>
          <input {...register('mobile')} className={inputClass} />
        </Field>

        <Field label="Street" error={errors.street?.message}>
          <input {...register('street')} className={inputClass} />
        </Field>

        <Field label="City" error={errors.city?.message}>
          <input {...register('city')} className={inputClass} />
        </Field>

        <Field label="State" error={errors.state?.message}>
          <input {...register('state')} className={inputClass} />
        </Field>

        <Field label="Country" error={errors.country?.message}>
          <input {...register('country')} className={inputClass} />
        </Field>

        <Field label="Pincode" error={errors.pincode?.message}>
          <input {...register('pincode')} className={inputClass} />
        </Field>
      </div>

      {isNew && (
        <label className="mt-5 flex items-center gap-2 text-sm text-[var(--color-ink-2)] select-none">
          <input type="checkbox" {...register('create_portal_user')} className="accent-[var(--color-accent)]" />
          Provision a portal login for this contact (requires an email above)
        </label>
      )}

      {serverError && (
        <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
    </FormShell>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
