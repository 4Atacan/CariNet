'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';
import {
  DocumentType,
  TransactionType,
  createTransactionSchema,
  type CreateTransactionInput,
} from '@carinet/shared';
import { DataTable } from '@/components/data-table';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { ApiError, apiGetPaged, apiPost, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type BuyerWithBalance, type Transaction } from '@/lib/types';
import { money, trDate } from '@/lib/utils';

const LIMIT = 20;

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['transactions', page],
    queryFn: () =>
      apiGetPaged<Transaction>(
        `/transactions${qs({ page, limit: LIMIT, includeCancelled: true })}`,
      ),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost(`/transactions/${id}/cancel`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const columns: ColumnDef<Transaction, unknown>[] = [
    { header: tr.common.date, cell: (c) => trDate(c.row.original.documentDate) },
    {
      header: tr.common.buyer,
      cell: (c) => (
        <span>
          <span className="font-mono text-xs text-ink-600">
            {c.row.original.buyerAccount.accountCode}
          </span>{' '}
          {c.row.original.buyerAccount.title}
        </span>
      ),
    },
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
      header: tr.transactions.type,
      cell: (c) =>
        c.row.original.type === 'DEBIT' ? (
          <Badge tone="debit">{tr.transactions.debit}</Badge>
        ) : (
          <Badge tone="credit">{tr.transactions.credit}</Badge>
        ),
    },
    {
      header: tr.transactions.amount,
      cell: (c) => (
        <span className="tabular-nums">
          {money(c.row.original.amount, c.row.original.currencyCode)}
        </span>
      ),
    },
    {
      header: tr.common.actions,
      cell: (c) => {
        const row = c.row.original;
        if (row.isCancelled) return <Badge tone="warn">{tr.transactions.cancelled}</Badge>;
        if (row.invoiceId) return <span className="text-xs text-ink-400">—</span>;
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const reason = window.prompt(tr.transactions.cancelReason);
              if (reason) cancel.mutate({ id: row.id, reason });
            }}
          >
            {tr.transactions.cancel}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={tr.transactions.title}
        description={tr.transactions.cancelHint}
        action={<Button onClick={() => setCreating((v) => !v)}>{tr.transactions.new}</Button>}
      />

      {error ? <Alert>{error}</Alert> : null}
      {creating ? <NewTransactionForm onDone={() => setCreating(false)} /> : null}

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        page={page}
        limit={LIMIT}
        total={list.data?.meta.total ?? 0}
        onPageChange={setPage}
        isLoading={list.isLoading}
      />
    </>
  );
}

function NewTransactionForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const buyers = useQuery({
    queryKey: ['buyers', 'all'],
    queryFn: () => apiGetPaged<BuyerWithBalance>('/buyers?limit=100'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createTransactionSchema>, unknown, CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      type: TransactionType.DEBIT,
      documentType: DocumentType.OTHER,
      currencyCode: 'TRY',
      exchangeRate: '1',
    },
  });

  const create = useMutation({
    mutationFn: (values: CreateTransactionInput) => apiPost('/transactions', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['buyers'] });
      onDone();
    },
    onError: (e) => setServerError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const optional = (v: string) => (v === '' ? undefined : v);

  return (
    <Card className="mb-6">
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          create.mutate(values);
        })}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        noValidate
      >
        <Field label={tr.common.buyer} error={errors.buyerAccountId?.message}>
          <Select {...register('buyerAccountId')}>
            <option value="">{tr.common.select}</option>
            {(buyers.data?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.accountCode} · {b.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tr.transactions.type} error={errors.type?.message}>
          <Select {...register('type')}>
            <option value={TransactionType.DEBIT}>{tr.transactions.debit}</option>
            <option value={TransactionType.CREDIT}>{tr.transactions.credit}</option>
          </Select>
        </Field>

        <Field label={tr.transactions.documentType} error={errors.documentType?.message}>
          <Select {...register('documentType')}>
            {Object.values(DocumentType).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tr.transactions.documentNo} error={errors.documentNo?.message}>
          <Input {...register('documentNo', { setValueAs: optional })} />
        </Field>

        <Field label={tr.transactions.documentDate} error={errors.documentDate?.message}>
          <Input type="date" {...register('documentDate')} />
        </Field>

        <Field label={tr.transactions.dueDate} error={errors.dueDate?.message}>
          <Input type="date" {...register('dueDate', { setValueAs: optional })} />
        </Field>

        <Field label={tr.transactions.amount} error={errors.amount?.message}>
          <Input {...register('amount')} inputMode="decimal" placeholder="0.00" />
        </Field>

        <Field label={tr.transactions.currency} error={errors.currencyCode?.message}>
          <div className="flex gap-2">
            <Select {...register('currencyCode')} className="w-24">
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
            <Input {...register('exchangeRate')} placeholder={tr.transactions.rate} />
          </div>
        </Field>

        <div className="sm:col-span-2 lg:col-span-3">
          <Field label={tr.transactions.description} error={errors.description?.message}>
            <Input {...register('description', { setValueAs: optional })} />
          </Field>
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? tr.common.saving : tr.common.save}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            {tr.common.cancel}
          </Button>
        </div>

        {serverError ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <Alert>{serverError}</Alert>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
