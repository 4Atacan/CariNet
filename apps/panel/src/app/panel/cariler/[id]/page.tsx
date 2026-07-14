'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Stat } from '@/components/ui';
import { ApiError, apiGet, apiGetPaged, apiPatch, apiPost, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type BuyerDetail, type StatementLine } from '@/lib/types';
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
        <span className="text-xs text-slate-500">
          {c.row.original.documentType}
          {c.row.original.documentNo ? ` · ${c.row.original.documentNo}` : ''}
        </span>
      ),
    },
    {
      header: tr.buyers.debit,
      cell: (c) =>
        c.row.original.type === 'DEBIT' ? (
          <span className="tabular-nums text-red-600">{money(c.row.original.amountTry)}</span>
        ) : null,
    },
    {
      header: tr.buyers.credit,
      cell: (c) =>
        c.row.original.type === 'CREDIT' ? (
          <span className="tabular-nums text-emerald-600">{money(c.row.original.amountTry)}</span>
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
          <p className="mb-2 text-sm text-slate-700">{tr.buyers.inviteReady}</p>
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
          <Badge tone="amber">{tr.buyers.inactive}</Badge>
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
    </>
  );
}
