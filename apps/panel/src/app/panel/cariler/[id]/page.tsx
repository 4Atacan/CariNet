'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { type MoneyString } from '@carinet/shared';
import { DataTable } from '@/components/data-table';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Stat } from '@/components/ui';
import {
  ApiError,
  apiBlob,
  apiDelete,
  apiGet,
  apiGetPaged,
  apiPatch,
  apiPost,
  qs,
} from '@/lib/api';
import { downloadExcel } from '@/lib/export';
import { tr } from '@/lib/tr';
import { type Address, type BuyerDetail, type RiskDetail, type StatementLine } from '@/lib/types';
import { balanceTone, money, trDate } from '@/lib/utils';

const LIMIT = 20;

export default function BuyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [range, setRange] = useState({ from: '', to: '' });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buyer = useQuery({
    queryKey: ['buyer', id],
    queryFn: () => apiGet<BuyerDetail>(`/buyers/${id}`),
  });

  const statement = useQuery({
    queryKey: ['statement', id, page, range],
    queryFn: () =>
      apiGetPaged<StatementLine>(
        `/buyers/${id}/statement${qs({ page, limit: LIMIT, from: range.from, to: range.to })}`,
      ),
  });

  const setActive = useMutation({
    mutationFn: (isActive: boolean) => apiPatch(`/buyers/${id}/active`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buyer', id] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const invite = useMutation({
    mutationFn: () => apiPost<{ url: string }>('/auth/invites', { buyerAccountId: id }),
    onSuccess: (data) => setInviteUrl(data.url),
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const columns: ColumnDef<StatementLine, unknown>[] = [
    { header: tr.common.date, cell: (c) => trDate(c.row.original.documentDate) },
    {
      header: tr.transactions.documentType,
      cell: (c) => (
        <span className="text-xs text-ink-600">
          {c.row.original.documentType}
          {c.row.original.documentNo ? ` · ${c.row.original.documentNo}` : ''}
        </span>
      ),
    },
    {
      header: tr.buyers.debit,
      cell: (c) =>
        c.row.original.type === 'DEBIT' ? (
          <span className="tabular-nums text-debit">{money(c.row.original.amountTry)}</span>
        ) : null,
    },
    {
      header: tr.buyers.credit,
      cell: (c) =>
        c.row.original.type === 'CREDIT' ? (
          <span className="tabular-nums text-credit">{money(c.row.original.amountTry)}</span>
        ) : null,
    },
    {
      header: tr.transactions.runningBalance,
      cell: (c) => (
        <span className={`tabular-nums font-medium ${balanceTone(c.row.original.runningBalance)}`}>
          {money(c.row.original.runningBalance)}
        </span>
      ),
    },
  ];

  const b = buyer.data;

  return (
    <>
      <PageHeader
        title={b ? `${b.accountCode} · ${b.title}` : tr.common.loading}
        description={
          b?.representative
            ? `${tr.common.representative}: ${b.representative.fullName}`
            : undefined
        }
        action={
          b ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  void downloadExcel('TRANSACTIONS', {
                    buyerAccountId: id,
                    from: range.from,
                    to: range.to,
                  })
                }
              >
                {tr.exports.excel}
              </Button>
              <Button
                variant="outline"
                onClick={() => void downloadStatementPdf(id, b.accountCode)}
              >
                {tr.reports.pdf}
              </Button>
              <Button variant="outline" onClick={() => invite.mutate()}>
                {tr.buyers.invite}
              </Button>
              <Button
                variant={b.isActive ? 'danger' : 'default'}
                onClick={() => setActive.mutate(!b.isActive)}
              >
                {b.isActive ? tr.buyers.deactivate : tr.buyers.activate}
              </Button>
            </div>
          ) : null
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      {inviteUrl ? (
        <Card className="mb-6">
          <p className="mb-2 text-sm text-ink-800">{tr.buyers.inviteReady}</p>
          <div className="flex gap-2">
            <Input readOnly value={inviteUrl} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
              {tr.common.copy}
            </Button>
          </div>
        </Card>
      ) : null}

      {b ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Stat
            label={tr.buyers.balance}
            value={money(b.balance.balance)}
            tone={balanceTone(b.balance.balance)}
          />
          <Stat label={tr.buyers.debit} value={money(b.balance.totalDebit)} />
          <Stat label={tr.buyers.credit} value={money(b.balance.totalCredit)} />
          <Stat label={tr.common.creditLimit} value={money(b.creditLimit)} />
        </div>
      ) : null}

      {b && !b.isActive ? (
        <div className="mb-4">
          <Badge tone="warn">{tr.buyers.inactive}</Badge>
        </div>
      ) : null}

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={`${tr.buyers.statement} — ${tr.common.date}`}>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => {
                setRange((r) => ({ ...r, from: e.target.value }));
                setPage(1);
              }}
            />
          </Field>
          <Field label="—">
            <Input
              type="date"
              value={range.to}
              onChange={(e) => {
                setRange((r) => ({ ...r, to: e.target.value }));
                setPage(1);
              }}
            />
          </Field>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={statement.data?.data ?? []}
        page={page}
        limit={LIMIT}
        total={statement.data?.meta.total ?? 0}
        onPageChange={setPage}
        isLoading={statement.isLoading}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AgingCard buyerAccountId={id} />
        <AddressesCard buyerAccountId={id} />
      </div>
    </>
  );
}

/** Risk foyu ozeti — yaslandirma kovalari (§13 Faz 2). */
function AgingCard({ buyerAccountId }: { buyerAccountId: string }) {
  const risk = useQuery({
    queryKey: ['risk', buyerAccountId],
    queryFn: () => apiGet<RiskDetail>(`/reports/risk/${buyerAccountId}`),
  });

  const data = risk.data;
  if (!data) return <Card>{tr.common.loading}</Card>;

  const buckets: [string, MoneyString][] = [
    ['0-30', data.buckets.D0_30],
    ['31-60', data.buckets.D31_60],
    ['61-90', data.buckets.D61_90],
    ['90+', data.buckets.D90_PLUS],
    [tr.reports.notDue, data.buckets.NOT_DUE],
  ];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-navy-900">{tr.reports.aging}</p>
        {data.limitUsagePercent !== null ? (
          <Badge
            tone={
              data.limitUsagePercent > 100
                ? 'debit'
                : data.limitUsagePercent > 80
                  ? 'warn'
                  : 'neutral'
            }
          >
            {tr.reports.limitUsage}: %{data.limitUsagePercent}
          </Badge>
        ) : null}
      </div>

      <ul className="divide-y divide-ink-100 text-sm">
        {buckets.map(([label, value]) => (
          <li key={label} className="flex items-center justify-between py-1.5">
            <span className="text-ink-700">{label}</span>
            <span
              className={`tabular-nums ${Number(value) > 0 ? 'text-navy-900' : 'text-ink-300'}`}
            >
              {money(value)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-ink-200 pt-3 text-sm">
        <span className="font-medium text-navy-900">{tr.reports.overdue}</span>
        <span className="tabular-nums font-medium text-debit">{money(data.overdue)}</span>
      </div>
      {data.averageDueDate ? (
        <p className="mt-2 text-xs text-ink-600">
          {tr.reports.averageDue}: {trDate(data.averageDueDate)}
          {data.averageOverdueDays > 0 ? ` (+${data.averageOverdueDays} gun)` : ''}
        </p>
      ) : null}
    </Card>
  );
}

function AddressesCard({ buyerAccountId }: { buyerAccountId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ label: '', fullAddress: '', city: '' });

  const addresses = useQuery({
    queryKey: ['addresses', buyerAccountId],
    queryFn: () => apiGet<Address[]>(`/addresses${qs({ buyerAccountId })}`),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['addresses', buyerAccountId] });

  const create = useMutation({
    mutationFn: () => apiPost('/addresses', { ...form, buyerAccountId }),
    onSuccess: async () => {
      setForm({ label: '', fullAddress: '', city: '' });
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (addressId: string) => apiDelete(`/addresses/${addressId}`),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <p className="mb-3 text-sm font-medium text-navy-900">{tr.addresses.title}</p>

      <ul className="mb-4 divide-y divide-ink-100 text-sm">
        {(addresses.data ?? []).map((address) => (
          <li key={address.id} className="flex items-start justify-between gap-3 py-2">
            <span>
              <span className="font-medium text-navy-900">{address.label}</span>
              <span className="block text-xs text-ink-600">
                {address.fullAddress} · {address.city}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(address.id)}>
              {tr.addresses.delete}
            </Button>
          </li>
        ))}
        {(addresses.data ?? []).length === 0 ? (
          <li className="py-2 text-ink-600">{tr.common.empty}</li>
        ) : null}
      </ul>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder={tr.addresses.label}
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
        />
        <Input
          placeholder={tr.addresses.fullAddress}
          value={form.fullAddress}
          onChange={(e) => setForm((f) => ({ ...f, fullAddress: e.target.value }))}
        />
        <div className="flex gap-2">
          <Input
            placeholder={tr.addresses.city}
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <Button
            size="sm"
            disabled={!form.label || !form.fullAddress || !form.city}
            onClick={() => create.mutate()}
          >
            {tr.addresses.add}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** PDF zarf disinda ham ikili doner → fetch + blob (cookie ile, kural #9). */
async function downloadStatementPdf(buyerAccountId: string, accountCode: string): Promise<void> {
  const blob = await apiBlob(`/reports/statement-pdf/${buyerAccountId}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ekstre-${accountCode}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
