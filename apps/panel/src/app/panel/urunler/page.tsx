'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { ApiError, apiGetPaged, apiPatch, apiPost, qs } from '@/lib/api';
import { downloadExcel } from '@/lib/export';
import { tr } from '@/lib/tr';
import { type Product } from '@/lib/types';
import { money } from '@/lib/utils';

const LIMIT = 20;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', unit: 'ADET', price: '', quantity: '' });

  const products = useQuery({
    queryKey: ['products', page, search],
    queryFn: () => apiGetPaged<Product>(`/products${qs({ page, limit: LIMIT, search })}`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/products', {
        code: form.code,
        name: form.name,
        unit: form.unit,
        ...(form.price ? { price: form.price } : {}),
        ...(form.quantity ? { quantity: form.quantity } : {}),
      }),
    onSuccess: async () => {
      setForm({ code: '', name: '', unit: 'ADET', price: '', quantity: '' });
      await refresh();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const setActive = useMutation({
    mutationFn: (p: { id: string; isActive: boolean }) =>
      apiPatch(`/products/${p.id}/active`, { isActive: p.isActive }),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const setStock = useMutation({
    mutationFn: (p: { id: string; quantity: string }) =>
      apiPatch(`/products/${p.id}/stock`, { quantity: p.quantity }),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const columns: ColumnDef<Product, unknown>[] = [
    {
      header: tr.products.code,
      cell: (c) => <span className="font-mono text-xs">{c.row.original.code}</span>,
    },
    {
      header: tr.products.name,
      cell: (c) => (
        <span>
          {c.row.original.name}
          {!c.row.original.isActive ? <Badge tone="neutral">{tr.products.inactive}</Badge> : null}
        </span>
      ),
    },
    { header: tr.products.unit, cell: (c) => c.row.original.unit },
    {
      header: tr.products.price,
      cell: (c) => (
        <span className="tabular-nums">
          {c.row.original.price ? money(c.row.original.price) : '—'}
        </span>
      ),
    },
    {
      header: tr.products.quantity,
      cell: (c) => (
        <StockCell
          value={c.row.original.quantity}
          onSave={(quantity) => setStock.mutate({ id: c.row.original.id, quantity })}
        />
      ),
    },
    {
      header: tr.common.actions,
      cell: (c) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setActive.mutate({ id: c.row.original.id, isActive: !c.row.original.isActive })
          }
        >
          {c.row.original.isActive ? tr.products.deactivate : tr.products.activate}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={tr.products.title}
        description={tr.products.description}
        action={
          <Button variant="outline" onClick={() => void downloadExcel('PRODUCTS')}>
            {tr.exports.excel}
          </Button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card className="mb-6">
        <p className="mb-3 text-sm font-medium text-navy-900">{tr.products.new}</p>
        <div className="grid gap-3 sm:grid-cols-6">
          <Field label={tr.products.code}>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={tr.products.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
          </div>
          <Field label={tr.products.unit}>
            <Input
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </Field>
          <Field label={tr.products.price}>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </Field>
          <Field label={tr.products.quantity}>
            <Input
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            disabled={!form.code || !form.name || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? tr.common.saving : tr.common.save}
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <Input
          placeholder={tr.products.search}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </Card>

      <DataTable
        columns={columns}
        data={products.data?.data ?? []}
        page={page}
        limit={LIMIT}
        total={products.data?.meta.total ?? 0}
        onPageChange={setPage}
        isLoading={products.isLoading}
      />
    </>
  );
}

/** Stok MUTLAK yazilir: kullanici sayim sonucunu girer, artirma/azaltma yok. */
function StockCell({ value, onSave }: { value: string; onSave: (quantity: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        className="tabular-nums text-navy-900 underline-offset-2 hover:underline"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {Number(value).toLocaleString('tr-TR')}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        className="h-7 w-24"
        inputMode="decimal"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        size="sm"
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
      >
        {tr.common.save}
      </Button>
    </span>
  );
}
