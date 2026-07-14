'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';
import { createBuyerAccountSchema, type CreateBuyerAccountInput } from '@carinet/shared';
import { DataTable } from '@/components/data-table';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { ApiError, apiGet, apiGetPaged, apiPost, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type BuyerWithBalance, type Representative } from '@/lib/types';
import { balanceTone, money } from '@/lib/utils';

const LIMIT = 20;

export default function BuyersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const buyers = useQuery({
    queryKey: ['buyers', page, q],
    queryFn: () => apiGetPaged<BuyerWithBalance>(`/buyers${qs({ page, limit: LIMIT, q })}`),
  });

  const columns: ColumnDef<BuyerWithBalance, unknown>[] = [
    {
      header: tr.common.accountCode,
      accessorKey: 'accountCode',
      cell: (c) => <span className="font-mono text-xs">{c.getValue() as string}</span>,
    },
    {
      header: tr.common.title,
      cell: (c) => (
        <span className="flex items-center gap-2">
          {c.row.original.title}
          {c.row.original.isActive ? null : <Badge tone="amber">{tr.buyers.inactive}</Badge>}
        </span>
      ),
    },
    {
      header: tr.common.representative,
      cell: (c) => (
        <span className="text-slate-500">
          {c.row.original.representative?.fullName ?? tr.common.none}
        </span>
      ),
    },
    {
      header: tr.common.creditLimit,
      cell: (c) => <span className="tabular-nums">{money(c.row.original.creditLimit)}</span>,
    },
    {
      header: tr.buyers.balance,
      cell: (c) => {
        const value = c.row.original.balance.balance;
        return (
          <span className={`tabular-nums font-medium ${balanceTone(value)}`}>{money(value)}</span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={tr.buyers.title}
        description={tr.buyers.description}
        action={<Button onClick={() => setCreating((v) => !v)}>{tr.buyers.new}</Button>}
      />

      {creating ? <NewBuyerForm onDone={() => setCreating(false)} /> : null}

      <div className="mb-4 max-w-sm">
        <Input
          placeholder={tr.buyers.search}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={buyers.data?.data ?? []}
        page={page}
        limit={LIMIT}
        total={buyers.data?.meta.total ?? 0}
        onPageChange={setPage}
        isLoading={buyers.isLoading}
        onRowClick={(row) => router.push(`/panel/cariler/${row.id}`)}
      />
    </>
  );
}

function NewBuyerForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const reps = useQuery({
    queryKey: ['representatives'],
    queryFn: () => apiGet<Representative[]>('/representatives'),
  });

  // Semada default'lar var → form GIRDI tipi ile CIKTI tipi ayrisir (z.input ≠ z.output).
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createBuyerAccountSchema>, unknown, CreateBuyerAccountInput>({
    resolver: zodResolver(createBuyerAccountSchema),
    defaultValues: { creditLimit: '0', isActive: true },
  });

  const create = useMutation({
    mutationFn: (values: CreateBuyerAccountInput) => apiPost('/buyers', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['buyers'] });
      onDone();
    },
    onError: (error) => setServerError(error instanceof ApiError ? error.message : tr.common.error),
  });

  return (
    <Card className="mb-6">
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          create.mutate(values);
        })}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        noValidate
      >
        <Field label={tr.common.accountCode} error={errors.accountCode?.message}>
          <Input {...register('accountCode')} placeholder="120.01.004" />
        </Field>
        <Field label={tr.common.title} error={errors.title?.message}>
          <Input {...register('title')} />
        </Field>
        <Field label={tr.buyers.vkn} error={errors.vknTckn?.message}>
          <Input
            {...register('vknTckn', { setValueAs: (v: string) => (v === '' ? undefined : v) })}
          />
        </Field>
        <Field label={tr.common.creditLimit} error={errors.creditLimit?.message}>
          <Input {...register('creditLimit')} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label={tr.common.representative} error={errors.representativeId?.message}>
          <Select
            {...register('representativeId', {
              setValueAs: (v: string) => (v === '' ? undefined : v),
            })}
          >
            <option value="">{tr.common.none}</option>
            {(reps.data ?? []).map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? tr.common.saving : tr.common.save}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            {tr.common.cancel}
          </Button>
        </div>

        {serverError ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <Alert>{serverError}</Alert>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
