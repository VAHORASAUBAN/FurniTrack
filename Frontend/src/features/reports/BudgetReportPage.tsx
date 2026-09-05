import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getBudget, listBudgets } from '../../api/endpoints/budgets'
import { BudgetDrillDownModal } from '../budgets/BudgetDrillDownModal'
import { formatMoney } from '../../lib/money'

/** Report > Budget Report — a read-only view across a budget's lines
 * (Planned vs Achieved, a chart, and the same traceability drill-down as
 * the Budgets screen), distinct from Account > Budgets, which is the
 * editable CRUD list. Previously this route just redirected to that list,
 * which read as "not working" since it never showed a report at all. */
export function BudgetReportPage() {
  const [budgetId, setBudgetId] = useState<number | null>(null)
  const [drillDownLineIndex, setDrillDownLineIndex] = useState<number | null>(null)

  const { data: budgetsPage, isLoading: isLoadingList } = useQuery({
    queryKey: ['budgets', 'report-picker'],
    queryFn: () => listBudgets({ page: 1, page_size: 100, sort: '-updated_at', include_archived: true }),
  })

  useEffect(() => {
    if (budgetId === null && budgetsPage && budgetsPage.items.length > 0) {
      const preferred = budgetsPage.items.find((b) => b.status === 'CONFIRMED') ?? budgetsPage.items[0]
      setBudgetId(preferred.id)
    }
  }, [budgetsPage, budgetId])

  const { data: budget, isLoading: isLoadingBudget } = useQuery({
    queryKey: ['budgets', budgetId],
    queryFn: () => getBudget(budgetId as number),
    enabled: budgetId !== null,
  })

  const chartData = (budget?.lines ?? []).map((l) => ({
    name: l.analytic_name,
    Planned: Number(l.planned_amount),
    Achieved: Number(l.achieved_amount),
  }))

  const totalPlanned = (budget?.lines ?? []).reduce((sum, l) => sum + Number(l.planned_amount), 0)
  const totalAchieved = (budget?.lines ?? []).reduce((sum, l) => sum + Number(l.achieved_amount), 0)
  const overallPct = totalPlanned === 0 ? 0 : (totalAchieved / totalPlanned) * 100

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">Budget Report</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--color-ink-2)]">Budget</label>
          <select
            value={budgetId ?? ''}
            onChange={(e) => setBudgetId(Number(e.target.value))}
            className="rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            {(budgetsPage?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.start_date} → {b.end_date}) · {b.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoadingList && <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>}

      {!isLoadingList && budgetsPage && budgetsPage.items.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--color-rule-2)] px-5 py-14 text-center text-sm text-[var(--color-ink-3)]">
          No budgets yet — create one under Account &rarr; Budgets first.
        </div>
      )}

      {!isLoadingBudget && budget && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                Total Planned
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-[var(--color-ink)]">
                {formatMoney(totalPlanned.toFixed(2))}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                Total Achieved
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-[var(--color-ink)]">
                {formatMoney(totalAchieved.toFixed(2))}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                Overall Achieved
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-[var(--color-accent)]">
                {overallPct.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-4">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-ink-3)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-ink-3)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)', border: '1px solid var(--color-rule)', fontSize: 12.5,
                    }}
                    formatter={(value: number) => formatMoney(value.toFixed(2))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12.5 }} />
                  <Bar dataKey="Planned" fill="var(--color-rule-2)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Achieved" fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Analytic Account
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Planned
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Achieved
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    %
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {budget.lines.map((line, index) => (
                  <tr
                    key={line.id}
                    onClick={() => setDrillDownLineIndex(index)}
                    className="cursor-pointer border-b border-[var(--color-rule)] last:border-0 hover:bg-[var(--color-accent-bg)]/50"
                  >
                    <td className="px-4 py-2.5 text-[var(--color-ink)]">{line.analytic_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(line.planned_amount)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(line.achieved_amount)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(line.achieved_pct).toFixed(0)}%</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatMoney(line.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {budget && drillDownLineIndex !== null && budget.lines[drillDownLineIndex] && (
        <BudgetDrillDownModal
          analyticId={budget.lines[drillDownLineIndex].analytic_account_id}
          analyticName={budget.lines[drillDownLineIndex].analytic_name}
          dateFrom={budget.start_date}
          dateTo={budget.end_date}
          onClose={() => setDrillDownLineIndex(null)}
        />
      )}
    </div>
  )
}
