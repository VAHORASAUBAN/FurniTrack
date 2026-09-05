import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { getProfitLoss } from '../../api/endpoints/reports'
import { formatMoney } from '../../lib/money'
import { openPdf } from '../../lib/pdf'
import type { ProfitLossLine } from '../../types/report'

function Section({ title, rows, total, negative = false }: { title: string; rows: ProfitLossLine[]; total: string; negative?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">{title}</h3>
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-sm text-[var(--color-ink-3)]">No activity.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex justify-between pl-3 text-sm">
            <span className="text-[var(--color-ink-2)]">{r.name}</span>
            <span className="font-mono">{formatMoney(r.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-[var(--color-rule)] pt-1.5 pl-3 text-sm font-semibold">
        <span>Total {title}</span>
        <span className={`font-mono ${negative ? 'text-[var(--color-danger)]' : ''}`}>{formatMoney(total)}</span>
      </div>
    </div>
  )
}

export function ProfitLossPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 4)}-01-01`)
  const [dateTo, setDateTo] = useState(today)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'profit-loss', dateFrom, dateTo],
    queryFn: () => getProfitLoss(dateFrom, dateTo),
  })

  const isProfit = data ? Number.parseFloat(data.net_profit) >= 0 : true

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">Profit &amp; Loss</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--color-ink-2)]">From</label>
          <input
            type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-[var(--color-rule-2)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <label className="text-sm text-[var(--color-ink-2)]">To</label>
          <input
            type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-[var(--color-rule-2)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={() => openPdf(`/reports/profit-loss/pdf?date_from=${dateFrom}&date_to=${dateTo}`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)]"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {isLoading && <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>}

      {data && (
        <div className="max-w-xl rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
          <div className="flex flex-col gap-6">
            <Section title="Income" rows={data.income} total={data.total_income} />
            <Section title="Expenses" rows={data.expenses} total={data.total_expenses} negative />
            <Section title="Other Expenses" rows={data.other_expenses} total={data.total_other_expense} negative />
          </div>

          <div
            className={`mt-6 flex justify-between rounded-md px-4 py-3 text-base font-semibold ${
              isProfit ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
            }`}
          >
            <span>Net {isProfit ? 'Profit' : 'Loss'}</span>
            <span className="font-mono">{formatMoney(data.net_profit)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
