import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { getBalanceSheet } from '../../api/endpoints/reports'
import { formatMoney } from '../../lib/money'
import type { AccountBalance } from '../../types/report'

function Section({ title, rows, total }: { title: string; rows: AccountBalance[]; total: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">{title}</h3>
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-sm text-[var(--color-ink-3)]">No activity.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex justify-between text-sm">
            <span className="text-[var(--color-ink-2)]">{r.name}</span>
            <span className="font-mono">{formatMoney(r.balance)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-[var(--color-rule-2)] pt-2 text-sm font-semibold">
        <span>Total {title}</span>
        <span className="font-mono">{formatMoney(total)}</span>
      </div>
    </div>
  )
}

export function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'balance-sheet', asOf],
    queryFn: () => getBalanceSheet(asOf),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">Balance Sheet</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--color-ink-2)]">As of</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-md border border-[var(--color-rule-2)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
      </div>

      {isLoading && <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>}

      {data && (
        <>
          <div
            className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium ${
              data.is_balanced
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
            }`}
          >
            {data.is_balanced ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {data.is_balanced
              ? 'Balanced — Assets equal Liabilities plus Equity.'
              : `Out of balance by ${formatMoney(data.difference)} — this should never happen.`}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Section title="Assets" rows={data.assets} total={data.total_assets} />
            <div className="flex flex-col gap-5">
              <Section title="Liabilities" rows={data.liabilities} total={data.total_liabilities} />
              <div className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">Equity</h3>
                <div className="flex flex-col gap-1.5">
                  {data.equity.map((r) => (
                    <div key={r.id} className="flex justify-between text-sm">
                      <span className="text-[var(--color-ink-2)]">{r.name}</span>
                      <span className="font-mono">{formatMoney(r.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-dashed border-[var(--color-rule-2)] pt-1.5 text-sm">
                    <span className="text-[var(--color-ink-2)]">Current Period Earnings</span>
                    <span className="font-mono">{formatMoney(data.net_income)}</span>
                  </div>
                </div>
                <div className="mt-3 flex justify-between border-t border-[var(--color-rule-2)] pt-2 text-sm font-semibold">
                  <span>Total Equity</span>
                  <span className="font-mono">{formatMoney(data.total_equity)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
