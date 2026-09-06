/**
 * The backend serialises every monetary field as a JSON STRING (e.g.
 * "6000.00"), never a bare number — design doc §2.2 / §5: Decimal-as-number
 * round-trips through JS as a float and can silently lose precision. This
 * module is the one place that turns those strings into display formatting;
 * arithmetic on money always happens server-side, this never re-derives a
 * total from parsed floats.
 */

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (Number.isNaN(num)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/** For a live line-total PREVIEW only (design doc §7.5) — the server always
 * recomputes and is the source of truth; this never gets sent back to it. */
export function previewLineTotal(quantity: number, unitPrice: number, taxRate: number): number {
  const subtotal = quantity * unitPrice
  const tax = subtotal * (taxRate / 100)
  return Math.round((subtotal + tax) * 100) / 100
}
