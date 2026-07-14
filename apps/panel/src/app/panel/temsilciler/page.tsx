'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createRepresentativeSchema, type CreateRepresentativeInput } from '@carinet/shared';
import { Alert, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { ApiError, api, apiGet, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type Representative } from '@/lib/types';

export default function RepresentativesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const reps = useQuery({
    queryKey: ['representatives'],
    queryFn: () => apiGet<Representative[]>('/representatives'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRepresentativeInput>({ resolver: zodResolver(createRepresentativeSchema) });

  const create = useMutation({
    mutationFn: (values: CreateRepresentativeInput) => apiPost('/representatives', values),
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ['representatives'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/representatives/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['representatives'] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const optional = (v: string) => (v === '' ? undefined : v);

  return (
    <>
      <PageHeader title={tr.representatives.title} />

      {error ? (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <Card className="mb-6">
        <form
          onSubmit={handleSubmit((values) => {
            setError(null);
            create.mutate(values);
          })}
          className="grid gap-4 sm:grid-cols-4"
          noValidate
        >
          <Field label={tr.representatives.fullName} error={errors.fullName?.message}>
            <Input {...register('fullName')} />
          </Field>
          <Field label={tr.representatives.phone} error={errors.phone?.message}>
            <Input {...register('phone', { setValueAs: optional })} />
          </Field>
          <Field label={tr.representatives.email} error={errors.email?.message}>
            <Input type="email" {...register('email', { setValueAs: optional })} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={isSubmitting}>
              {tr.representatives.new}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <ul className="divide-y divide-slate-100 text-sm">
          {(reps.data ?? []).map((rep) => (
            <li key={rep.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-medium text-slate-900">{rep.fullName}</span>
                <span className="ml-2 text-slate-500">{rep.phone ?? ''}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {tr.representatives.accountCount}: {rep.buyerAccountCount ?? 0}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => remove.mutate(rep.id)}>
                {tr.representatives.delete}
              </Button>
            </li>
          ))}
          {(reps.data ?? []).length === 0 ? (
            <li className="py-2 text-slate-500">{tr.common.empty}</li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}
