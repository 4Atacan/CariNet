'use client';

import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { sum, type MoneyString } from '@carinet/shared';
import { DataTable } from '@/components/data-table';
import { Badge, Card, PageHeader, Select, Stat } from '@/components/ui';
import { apiGet, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type BuyerWithBalance } from '@/lib/types';
import { balanceTone, money, trDate } from '@/lib/utils';

interface RiskRow {
  buyerAccountId: string;
  accountCode: string;
  title: string;
  creditLimit: MoneyString;
  balance: MoneyString;
  overdue: MoneyString;
  notDue: MoneyString;
  buckets: Record<'NOT_DUE' | 'D0_30' | 'D31_60' | 'D61_90' | 'D90_PLUS', MoneyString>;
  limitUsagePercent: number | null;
  averageDueDate: string | null;
  averageOverdueDays: number | null;
}

interface Periodic {
  openingBalance: MoneyString;
  points: { period: string; debit: MoneyString; credit: MoneyString; balance: MoneyString }[];
}

export default function ReportsPage() {
  const [accountId, setAccountId] = useState('');

  const risk = useQuery({
    queryKey: ['risk'],
    queryFn: () => apiGet<RiskRow[]>('/reports/risk'),
  });

  const buyers = useQuery({
    queryKey: ['buyers', 'all'],
    queryFn: () => apiGet<BuyerWithBalance[]>('/buyers?limit=100'),
  });

  const periodic = useQuery({
    queryKey: ['periodic', accountId],
    queryFn: () =>
      apiGet<Periodic>(`/reports/periodic-balance${qs({ buyerAccountId: accountId })}`),
  });

  const rows = risk.data ?? [];
  const totalOverdue = sum(rows.map((r) => r.overdue));
  const totalBalance = sum(rows.map((r) => r.balance));
  const overLimit = rows.filter((r) => (r.limitUsagePercent ?? 0) > 100);

  const columns: ColumnDef<RiskRow, unknown>[] = [
    {
      header: tr.common.accountCode,
      cell: (c) => <span className="font-mono text-xs">{c.row.original.accountCode}</span>,
    },
    { header: tr.common.title, cell: (c) => c.row.original.title },
    {
      header: tr.reports.balance,
      cell: (c) => (
        <span className={`tabular-nums font-medium ${balanceTone(c.row.original.balance)}`}>
          {money(c.row.original.balance)}
        </span>
      ),
    },
    {
      header: tr.reports.overdue,
      cell: (c) => (
        <span className="tabular-nums text-red-600">{money(c.row.original.overdue)}</span>
      ),
    },
    { header: '0-30', cell: (c) => <Money value={c.row.original.buckets.D0_30} /> },
    { header: '31-60', cell: (c) => <Money value={c.row.original.buckets.D31_60} /> },
    { header: '61-90', cell: (c) => <Money value={c.row.original.buckets.D61_90} /> },
    { header: '90+', cell: (c) => <Money value={c.row.original.buckets.D90_PLUS} /> },
    {
      header: tr.reports.limitUsage,
      cell: (c) => {
        const percent = c.row.original.limitUsagePercent;
        if (percent === null) return <span className="text-xs text-slate-400">—</span>;
        const tone = percent > 100 ? 'red' : percent > 80 ? 'amber' : 'slate';
        return <Badge tone={tone}>%{percent}</Badge>;
      },
    },
    {
      header: tr.reports.averageDue,
      cell: (c) => {
        const row = c.row.original;
        if (!row.averageDueDate) return <span className="text-xs text-slate-400">—</span>;
        return (
          <span className="text-xs">
            {trDate(row.averageDueDate)}
            {row.averageOverdueDays !== null && row.averageOverdueDays > 0 ? (
              <span className="ml-1 text-red-600">(+{row.averageOverdueDays}g)</span>
            ) : null}
          </span>
        );
      },
    },
  ];

  const chartData = (periodic.data?.points ?? []).map((p) => ({
    period: p.period,
    borc: Number(p.debit),
    alacak: -Number(p.credit),
    bakiye: Number(p.balance),
  }));

  return (
    <>
      <PageHeader title={tr.reports.title} description={tr.reports.description} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label={tr.reports.totalBalance}
          value={money(totalBalance)}
          tone={balanceTone(totalBalance)}
        />
        <Stat
          label={tr.reports.totalOverdue}
          value={money(totalOverdue)}
          tone={Number(totalOverdue) > 0 ? 'text-red-600' : undefined}
        />
        <Stat
          label={tr.reports.overLimit}
          value={String(overLimit.length)}
          tone={overLimit.length > 0 ? 'text-red-600' : undefined}
        />
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-900">{tr.reports.periodic}</p>
          <div className="w-64">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{tr.reports.allAccounts}</option>
              {(buyers.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.accountCode} · {b.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500">{tr.common.empty}</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" width={70} />
                <Tooltip
                  formatter={(value, name) => [money(Number(value).toFixed(2)), String(name)]}
                />
                <Bar dataKey="borc" name={tr.buyers.debit} fill="#ef4444" />
                <Bar dataKey="alacak" name={tr.buyers.credit} fill="#10b981" />
                <Line
                  type="monotone"
                  dataKey="bakiye"
                  name={tr.reports.balance}
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {periodic.data ? (
          <p className="mt-2 text-xs text-slate-500">
            {tr.reports.openingBalance}: {money(periodic.data.openingBalance)}
          </p>
        ) : null}
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        page={1}
        limit={rows.length || 1}
        total={rows.length}
        onPageChange={() => undefined}
        isLoading={risk.isLoading}
      />
    </>
  );
}

function Money({ value }: { value: MoneyString }) {
  if (Number(value) === 0) return <span className="text-xs text-slate-300">—</span>;
  return <span className="tabular-nums text-xs">{money(value)}</span>;
}
