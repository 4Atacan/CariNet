'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { type z } from 'zod';
import {
  computeInvoiceTotals,
  createInvoiceSchema,
  type CreateInvoiceInput,
} from '@carinet/shared';
import { DataTable } from '@/components/data-table';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { ApiError, apiGetPaged, apiPost, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type BuyerWithBalance, type InvoiceSummary } from '@/lib/types';
import { money, trDate } from '@/lib/utils';

const LIMIT = 20;

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['invoices', page],
    queryFn: () =>
      apiGetPaged<InvoiceSummary>(`/invoices${qs({ page, limit: LIMIT, includeCancelled: true })}`),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost(`/invoices/${id}/cancel`, { reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['buyers'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const columns: ColumnDef<InvoiceSummary, unknown>[] = [
    {
      header: tr.invoices.invoiceNo,
      cell: (c) => <span className="font-mono text-xs">{c.row.original.invoiceNo}</span>,
    },
    { header: tr.invoices.invoiceDate, cell: (c) => trDate(c.row.original.invoiceDate) },
    {
      header: tr.common.buyer,
      cell: (c) => c.row.original.buyerAccount.title,
    },
    { header: tr.transactions.dueDate, cell: (c) => trDate(c.row.original.dueDate) },
    {
      header: tr.invoices.grandTotal,
      cell: (c) => (
        <span className="tabular-nums font-medium">
          {money(c.row.original.grandTotal, c.row.original.currencyCode)}
        </span>
      ),
    },
    {
      header: tr.common.actions,
      cell: (c) =>
        c.row.original.isCancelled ? (
          <Badge tone="amber">{tr.transactions.cancelled}</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const reason = window.prompt(tr.transactions.cancelReason);
              if (reason) cancel.mutate({ id: c.row.original.id, reason });
            }}
          >
            {tr.transactions.cancel}
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={tr.invoices.title}
        description={tr.invoices.totalsHint}
        action={<Button onClick={() => setCreating((v) => !v)}>{tr.invoices.new}</Button>}
      />

      {error ? <Alert>{error}</Alert> : null}
      {creating ? <NewInvoiceForm onDone={() => setCreating(false)} /> : null}

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

/** Semada default'lar var → form GIRDI tipi ile CIKTI tipi ayrisir (z.input ≠ z.output). */
type InvoiceFormValues = z.input<typeof createInvoiceSchema>;

const EMPTY_ITEM = { name: '', unit: 'ADET', quantity: '1', unitPrice: '0.00', taxRate: '20' };

function NewInvoiceForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const buyers = useQuery({
    queryKey: ['buyers', 'all'],
    queryFn: () => apiGetPaged<BuyerWithBalance>('/buyers?limit=100'),
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues, unknown, CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: { currencyCode: 'TRY', exchangeRate: '1', items: [EMPTY_ITEM] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const currency = useWatch({ control, name: 'currencyCode' }) ?? 'TRY';

  // Onizleme icin ayni hesap fonksiyonu (sunucu yine kendisi hesaplar — istemciye guvenilmez).
  const preview = safeTotals(items);

  const create = useMutation({
    mutationFn: (values: CreateInvoiceInput) => apiPost('/invoices', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <Field label={tr.invoices.invoiceNo} error={errors.invoiceNo?.message}>
            <Input {...register('invoiceNo')} />
          </Field>
          <Field label={tr.invoices.invoiceDate} error={errors.invoiceDate?.message}>
            <Input type="date" {...register('invoiceDate')} />
          </Field>
          <Field label={tr.transactions.dueDate} error={errors.dueDate?.message}>
            <Input type="date" {...register('dueDate', { setValueAs: optional })} />
          </Field>
          <Field label={tr.transactions.currency} error={errors.exchangeRate?.message}>
            <div className="flex gap-2">
              <Select {...register('currencyCode')} className="w-24">
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
              <Input {...register('exchangeRate')} placeholder={tr.transactions.rate} />
            </div>
          </Field>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {tr.invoices.items}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => append(EMPTY_ITEM)}>
              {tr.invoices.addItem}
            </Button>
          </div>

          <div className="space-y-2 p-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <Input
                    placeholder={tr.invoices.itemName}
                    {...register(`items.${index}.name` as const)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input placeholder={tr.invoices.unit} {...register(`items.${index}.unit`)} />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    placeholder={tr.invoices.quantity}
                    inputMode="decimal"
                    {...register(`items.${index}.quantity`)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    placeholder={tr.invoices.unitPrice}
                    inputMode="decimal"
                    {...register(`items.${index}.unitPrice`)}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Input
                    placeholder={tr.invoices.taxRate}
                    inputMode="decimal"
                    {...register(`items.${index}.taxRate`)}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
            {errors.items?.message ? (
              <span className="text-xs text-red-600">{errors.items.message}</span>
            ) : null}
          </div>

          <div className="flex justify-end gap-6 border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm">
            <span className="text-slate-500">
              {tr.invoices.netTotal}:{' '}
              <span className="tabular-nums text-slate-900">
                {money(preview.netTotal, currency)}
              </span>
            </span>
            <span className="text-slate-500">
              {tr.invoices.taxTotal}:{' '}
              <span className="tabular-nums text-slate-900">
                {money(preview.taxTotal, currency)}
              </span>
            </span>
            <span className="font-medium text-slate-900">
              {tr.invoices.grandTotal}:{' '}
              <span className="tabular-nums">{money(preview.grandTotal, currency)}</span>
            </span>
          </div>
        </div>

        {serverError ? <Alert>{serverError}</Alert> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? tr.common.saving : tr.common.save}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            {tr.common.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Form yazilirken gecersiz ara degerler olur; onizleme hesabi patlamamali. */
function safeTotals(items: InvoiceFormValues['items'] | undefined) {
  try {
    return computeInvoiceTotals(
      (items ?? []).map((item) => ({
        quantity: item.quantity || '0',
        unitPrice: item.unitPrice || '0',
        taxRate: item.taxRate || '0',
      })),
    );
  } catch {
    return { netTotal: '0.00', taxTotal: '0.00', grandTotal: '0.00', lines: [] };
  }
}
