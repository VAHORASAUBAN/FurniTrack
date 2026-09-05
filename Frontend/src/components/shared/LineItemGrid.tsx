import { Plus, Trash2 } from 'lucide-react'
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type UseFormSetValue,
} from 'react-hook-form'
import { accountOptions } from '../../api/endpoints/accounts'
import { analyticAccountOptions } from '../../api/endpoints/analyticAccounts'
import { getProduct, productOptions } from '../../api/endpoints/products'
import { formatMoney } from '../../lib/money'
import { Many2OneSelect } from './Many2OneSelect'
import { MoneyInput } from './MoneyInput'

export const emptyDocumentLine = {
  product_id: null,
  account_id: null,
  analytic_account_id: null,
  description: '',
  quantity: '1',
  unit_price: '0',
  tax_rate: '0',
}

function toNum(v: string | undefined): number {
  const n = Number.parseFloat(v || '0')
  return Number.isNaN(n) ? 0 : n
}

function lineTotal(line: { quantity?: string; unit_price?: string; tax_rate?: string } | undefined): number {
  if (!line) return 0
  const subtotal = toNum(line.quantity) * toNum(line.unit_price)
  return subtotal + subtotal * (toNum(line.tax_rate) / 100)
}

interface LineItemGridProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  setValue: UseFormSetValue<TFieldValues>
  name: Path<TFieldValues>
  isPurchase: boolean
  disabled?: boolean
}

/** Design doc §7.4 — one editable order-line grid for all four document
 * types (Purchase Order, Vendor Bill, Sales Order, Customer Invoice),
 * parameterised only by `isPurchase` (which of the product's two accounts
 * and two prices to autofill). Emits only quantity/unit_price/tax_rate per
 * line — the footer total is a preview, the server always recomputes
 * (design doc §7.5). Generic over the host form's field values so each
 * caller's own `Control`/`setValue` types flow through without an `any`. */
export function LineItemGrid<TFieldValues extends FieldValues>({
  control,
  setValue,
  name,
  isPurchase,
  disabled = false,
}: LineItemGridProps<TFieldValues>) {
  // `name` is always an array-field path at runtime (the host form's line-items
  // array), but that's not something the generic Path<T> can prove statically —
  // useFieldArray/append need the narrower ArrayPath<T>, hence the local casts here.
  const { fields, append, remove } = useFieldArray({ control, name: name as any })
  const watchedLines = (useWatch({ control, name }) as any[]) ?? []

  const untaxed = watchedLines.reduce((sum: number, l: any) => sum + toNum(l?.quantity) * toNum(l?.unit_price), 0)
  const total = watchedLines.reduce((sum: number, l: any) => sum + lineTotal(l), 0)
  const tax = total - untaxed

  function path(suffix: string): Path<TFieldValues> {
    return `${name}.${suffix}` as Path<TFieldValues>
  }

  async function handleProductSelect(index: number, productId: number | null) {
    setValue(path(`${index}.product_id`), productId as never)
    if (productId == null) return
    const product = await getProduct(productId)
    setValue(path(`${index}.account_id`), (isPurchase ? product.expense_account_id : product.income_account_id) as never)
    setValue(path(`${index}.unit_price`), (isPurchase ? product.purchase_cost : product.sales_price) as never)
    setValue(path(`${index}.tax_rate`), product.default_tax_rate as never)
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-[var(--color-rule)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
              <th className="px-3 py-2 w-10">Sr.</th>
              <th className="px-3 py-2 min-w-[160px]">Product</th>
              <th className="px-3 py-2 min-w-[160px]">Chart of Account</th>
              <th className="px-3 py-2 min-w-[150px]">Budget Analytics</th>
              <th className="px-3 py-2 w-24 text-right">Qty</th>
              <th className="px-3 py-2 w-28 text-right">Unit Price</th>
              <th className="px-3 py-2 w-20 text-right">Tax %</th>
              <th className="px-3 py-2 w-28 text-right">Total</th>
              {!disabled && <th className="px-3 py-2 w-10" />}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id} className="border-b border-[var(--color-rule)] last:border-0">
                <td className="px-3 py-2 text-[var(--color-ink-3)]">{index + 1}</td>
                <td className="px-3 py-2">
                  <Controller
                    name={path(`${index}.product_id`)}
                    control={control}
                    render={({ field: f }) => (
                      <Many2OneSelect
                        value={f.value}
                        onChange={(v) => handleProductSelect(index, v)}
                        queryKey="products"
                        fetchOptions={productOptions}
                        placeholder="Select product…"
                      />
                    )}
                  />
                </td>
                <td className="px-3 py-2">
                  <Controller
                    name={path(`${index}.account_id`)}
                    control={control}
                    render={({ field: f }) => (
                      <Many2OneSelect
                        value={f.value}
                        onChange={f.onChange}
                        queryKey="accounts"
                        fetchOptions={accountOptions}
                        placeholder="Account…"
                      />
                    )}
                  />
                </td>
                <td className="px-3 py-2">
                  <Controller
                    name={path(`${index}.analytic_account_id`)}
                    control={control}
                    render={({ field: f }) => (
                      <Many2OneSelect
                        value={f.value}
                        onChange={f.onChange}
                        queryKey="analytic-accounts"
                        fetchOptions={analyticAccountOptions}
                        placeholder="—"
                      />
                    )}
                  />
                </td>
                <td className="px-3 py-2">
                  <Controller
                    name={path(`${index}.quantity`)}
                    control={control}
                    render={({ field: f }) => <MoneyInput {...f} disabled={disabled} />}
                  />
                </td>
                <td className="px-3 py-2">
                  <Controller
                    name={path(`${index}.unit_price`)}
                    control={control}
                    render={({ field: f }) => <MoneyInput {...f} disabled={disabled} />}
                  />
                </td>
                <td className="px-3 py-2">
                  <Controller
                    name={path(`${index}.tax_rate`)}
                    control={control}
                    render={({ field: f }) => <MoneyInput {...f} disabled={disabled} />}
                  />
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-ink-2)]">
                  {formatMoney(lineTotal(watchedLines[index]).toFixed(2))}
                </td>
                {!disabled && (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-[var(--color-ink-3)] hover:text-[var(--color-danger)]"
                      aria-label="Remove line"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={() => append({ ...emptyDocumentLine } as any)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          <Plus size={15} /> Add line
        </button>
      )}

      <div className="mt-4 flex justify-end">
        <div className="w-64 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-[var(--color-ink-2)]">Untaxed Amount</span>
            <span className="font-mono">{formatMoney(untaxed.toFixed(2))}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-[var(--color-ink-2)]">Tax</span>
            <span className="font-mono">{formatMoney(tax.toFixed(2))}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-[var(--color-rule-2)] pt-1.5 font-semibold">
            <span>Total</span>
            <span className="font-mono">{formatMoney(total.toFixed(2))}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
