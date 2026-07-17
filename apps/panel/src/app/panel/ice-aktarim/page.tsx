'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ImportTarget } from '@carinet/shared';
import { Alert, Badge, Button, Card, Field, PageHeader, Select, Stat } from '@/components/ui';
import { ApiError, apiGetPaged, apiPost, apiUpload } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type ImportBatch, type ImportPreview } from '@/lib/types';
import { trDate } from '@/lib/utils';

/**
 * §6.6 hatti UI'da: yukle → onizleme + hata raporu → ONAY → commit.
 * Onay verilmeden HICBIR finansal kayit yazilmaz.
 */
export default function ImportsPage() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string>(ImportTarget.TRANSACTIONS);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ['imports'],
    queryFn: () => apiGetPaged<ImportBatch>('/imports?limit=10'),
  });

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file!);
      form.append('target', target);
      return apiUpload<ImportPreview>('/imports', form);
    },
    onSuccess: (data) => {
      setPreview(data);
      setError(null);
    },
    onError: (e) => {
      setPreview(null);
      setError(e instanceof ApiError ? formatError(e) : tr.common.error);
    },
  });

  const commit = useMutation({
    mutationFn: () =>
      apiPost<{ totals: Record<string, number> }>(`/imports/${preview!.batchId}/commit`, {
        skipErrorRows: skipErrors,
      }),
    onSuccess: async (data) => {
      setResult(JSON.stringify(data.totals));
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['imports'] });
      await queryClient.invalidateQueries({ queryKey: ['buyers'] });
    },
    onError: (e) => setError(e instanceof ApiError ? formatError(e) : tr.common.error),
  });

  const cancelBatch = useMutation({
    mutationFn: (id: string) => apiPost(`/imports/${id}/cancel`, { reason: 'Panelden iptal' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['imports'] });
      await queryClient.invalidateQueries({ queryKey: ['buyers'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  return (
    <>
      <PageHeader title={tr.imports.title} description={tr.imports.description} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Field label={tr.imports.target}>
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value={ImportTarget.TRANSACTIONS}>{tr.imports.targets.TRANSACTIONS}</option>
                <option value={ImportTarget.BUYER_ACCOUNTS}>
                  {tr.imports.targets.BUYER_ACCOUNTS}
                </option>
                <option value={ImportTarget.INVOICES}>{tr.imports.targets.INVOICES}</option>
              </Select>
            </Field>
          </div>

          <div className="w-72">
            <Field label={tr.imports.file}>
              <input
                type="file"
                accept=".xlsx,.xls,.xml,.zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-white"
              />
            </Field>
          </div>

          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? tr.imports.uploading : tr.imports.upload}
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {result ? (
        <div className="mb-6">
          <Alert tone="info">
            {tr.imports.result}: {result}
          </Alert>
        </div>
      ) : null}

      {preview ? (
        <Card className="mb-6">
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Stat label={tr.imports.rowCount} value={String(preview.totals.rowCount)} />
            <Stat
              label={tr.imports.validCount}
              value={String(preview.totals.validCount)}
              tone="text-credit"
            />
            <Stat
              label={tr.imports.errorCount}
              value={String(preview.totals.errorCount)}
              tone={preview.totals.errorCount > 0 ? 'text-debit' : undefined}
            />
          </div>

          {preview.duplicateOfBatchId ? (
            <div className="mb-4">
              <Alert tone="info">{tr.imports.duplicate}</Alert>
            </div>
          ) : null}

          {preview.mapping ? (
            <p className="mb-4 text-xs text-ink-600">
              {tr.imports.mapping}:{' '}
              {Object.entries(preview.mapping)
                .filter(([key]) => !key.startsWith('__'))
                .map(([field, header]) => `${field} ← ${header}`)
                .join(' · ')}
            </p>
          ) : null}

          {preview.errors.length > 0 ? (
            <div className="mb-4 rounded-lg border border-debit/25">
              <p className="border-b border-debit/25 bg-debit-soft px-3 py-2 text-xs font-semibold text-debit">
                {tr.imports.errorsTitle}
              </p>
              <ul className="max-h-48 divide-y divide-debit/15 overflow-y-auto text-xs">
                {preview.errors.map((row) => (
                  <li key={row.rowNo} className="px-3 py-1.5">
                    <span className="font-mono text-ink-600">#{row.rowNo}</span>{' '}
                    <span className="text-debit">{row.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-4">
            <Button onClick={() => commit.mutate()} disabled={commit.isPending}>
              {tr.imports.commit}
            </Button>
            {preview.totals.errorCount > 0 ? (
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={skipErrors}
                  onChange={(e) => setSkipErrors(e.target.checked)}
                />
                {tr.imports.skipErrors}
              </label>
            ) : null}
            <Button variant="ghost" onClick={() => setPreview(null)}>
              {tr.common.cancel}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <p className="mb-3 text-sm font-medium text-navy-900">{tr.imports.history}</p>
        <ul className="divide-y divide-ink-100 text-sm">
          {(history.data?.data ?? []).map((batch) => (
            <li key={batch.id} className="flex items-center justify-between py-2">
              <span className="text-ink-800">
                <span className="text-xs text-ink-600">{trDate(batch.createdAt)}</span>{' '}
                {batch.fileName ?? batch.sourceType}{' '}
                <Badge tone={batch.status === 'COMMITTED' ? 'credit' : 'neutral'}>
                  {batch.status}
                </Badge>
              </span>
              {batch.status === 'COMMITTED' ? (
                <Button size="sm" variant="outline" onClick={() => cancelBatch.mutate(batch.id)}>
                  {tr.imports.cancelBatch}
                </Button>
              ) : null}
            </li>
          ))}
          {(history.data?.data ?? []).length === 0 ? (
            <li className="py-2 text-ink-600">{tr.common.empty}</li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}

/** Eslenemeyen kolonlar gibi ayrintilari kullaniciya gosterir (§6.6 hata raporu). */
function formatError(error: ApiError): string {
  const details = error.details as { missing?: string[]; headers?: string[] } | undefined;
  if (details?.missing) {
    return `${error.message}: ${details.missing.join(', ')}`;
  }
  return error.message;
}
