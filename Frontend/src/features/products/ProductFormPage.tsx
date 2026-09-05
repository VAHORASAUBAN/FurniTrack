import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { accountOptions } from '../../api/endpoints/accounts'
import { getApiErrorMessage } from '../../api/client'
import {
  archiveProduct,
  createProduct,
  getProduct,
  productCategoryOptions,
  createProductCategory,
  unarchiveProduct,
  updateProduct,
} from '../../api/endpoints/products'
import { FormShell } from '../../components/shared/FormShell'
import { Many2OneSelect } from '../../components/shared/Many2OneSelect'
import { MoneyInput } from '../../components/shared/MoneyInput'
import { useAuthStore } from '../../stores/authStore'

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (e.g. 100 or 100.50)')
  .optional()
  .or(z.literal(''))

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  product_type: z.enum(['GOODS', 'SERVICE', 'COMBO']),
  category_id: z.number().nullable().optional(),
  sales_price: moneyString,
  purchase_cost: moneyString,
  default_tax_rate: moneyString,
  income_account_id: z.number().nullable().optional(),
  expense_account_id: z.number().nullable().optional(),
})
type FormValues = z.infer<typeof schema>

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const productId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: product, isLoading } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => getProduct(productId as number),
    enabled: !isNew,
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: product
      ? {
          name: product.name,
          product_type: product.product_type,
          category_id: product.category_id,
          sales_price: product.sales_price,
          purchase_cost: product.purchase_cost,
          default_tax_rate: product.default_tax_rate,
          income_account_id: product.income_account_id,
          expense_account_id: product.expense_account_id,
        }
      : undefined,
    defaultValues: { product_type: 'GOODS' },
  })

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate(`/products/${p.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (values: Partial<FormValues>) => updateProduct(productId as number, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const archiveMutation = useMutation({
    mutationFn: () => (product?.is_active ? archiveProduct(productId as number) : unarchiveProduct(productId as number)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    isNew ? createMutation.mutate(values) : updateMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  const canArchive = role === 'ADMIN' && !isNew

  return (
    <FormShell
      title={isNew ? 'New Product' : product?.name ?? 'Product'}
      status={!isNew && product ? (product.is_active ? 'ACTIVE' : 'ARCHIVED') : undefined}
      onBack={() => navigate('/products')}
      actions={[
        ...(canArchive
          ? [
              {
                label: product?.is_active ? 'Archive' : 'Unarchive',
                onClick: () => archiveMutation.mutate(),
                variant: (product?.is_active ? 'danger' : 'secondary') as 'danger' | 'secondary',
              },
            ]
          : []),
        {
          label: createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save',
          onClick: handleSubmit(onSubmit),
          variant: 'primary',
          disabled: createMutation.isPending || updateMutation.isPending,
        },
      ]}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Product Name</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Type</label>
          <select {...register('product_type')} className={inputClass}>
            <option value="GOODS">Goods</option>
            <option value="SERVICE">Service</option>
            <option value="COMBO">Combo</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Category</label>
          <Controller
            name="category_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="product-categories"
                fetchOptions={productCategoryOptions}
                placeholder="Select or create a category…"
                onCreateNew={async (name) => {
                  const category = await createProductCategory(name)
                  return { id: category.id, label: category.name }
                }}
                createLabel="Create category"
              />
            )}
          />
        </div>

        <div />

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Sales Price</label>
          <MoneyInput {...register('sales_price')} />
          {errors.sales_price && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.sales_price.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Cost</label>
          <MoneyInput {...register('purchase_cost')} />
          {errors.purchase_cost && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.purchase_cost.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Default Tax Rate (%)</label>
          <MoneyInput {...register('default_tax_rate')} />
          {errors.default_tax_rate && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.default_tax_rate.message}</p>
          )}
        </div>

        <div />

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Sales (Income) Account</label>
          <Controller
            name="income_account_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="accounts"
                fetchOptions={accountOptions}
                placeholder="Select an income account…"
              />
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Purchase (Expense) Account</label>
          <Controller
            name="expense_account_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="accounts"
                fetchOptions={accountOptions}
                placeholder="Select an expense account…"
              />
            )}
          />
        </div>
      </div>

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
