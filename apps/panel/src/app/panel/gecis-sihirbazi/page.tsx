'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ImportTarget } from '@carinet/shared';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Stat } from '@/components/ui';
import { ApiError, apiGet, apiPost, apiUpload, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type ImportPreview, type ValidationReport } from '@/lib/types';
import { balanceTone, money } from '@/lib/utils';

/**
 * §9 Gecis Sihirbazi: kesim tarihi → devir dosyasi → DOGRULAMA RAPORU → commit.
 * Fark kapanmadan commit yapilamaz (sunucu da ayni kontrolu tekrar eder).
 */
export default function WizardPage() {
  const queryClient = useQueryClient();
  const [cutoffDate, setCutoffDate] = useState('');
  const [expectedTotal, setExpectedTotal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file!);
      form.append('target', ImportTarget.OPENING_BALANCES);
      form.append('sourceType', 'WIZARD');
      form.append('cutoffDate', cutoffDate);
      return apiUpload<ImportPreview>('/imports', form);
    },
    onSuccess: async (data) => {
      setError(null);
      setBatchId(data.batchId);
      const fresh = await apiGet<ValidationReport>(
        `/imports/${data.batchId}/validation-report${qs({ expectedTotal })}`,
      );
      setReport(fresh);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const commit = useMutation({
    mutationFn: () =>
      apiPost<{ totals: Record<string, number> }>(`/imports/${batchId}/commit`, {
        expectedTotal: expectedTotal || undefined,
      }),
    onSuccess: async (data) => {
      setDone(
        `${tr.wizard.newAccounts}: ${data.totals.createdAccounts ?? 0} · ${tr.imports.committed}: ${
          data.totals.createdTransactions ?? 0
        }`,
      );
      setReport(null);
      setBatchId(null);
      await queryClient.invalidateQueries({ queryKey: ['buyers'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  return (
    <>
      <PageHeader title={tr.wizard.title} description={tr.wizard.description} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Field label={tr.wizard.cutoff}>
              <Input
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="w-64">
            <Field label={tr.wizard.expectedTotal} hint="Ornek: 1250000.00">
              <Input
                inputMode="decimal"
                value={expectedTotal}
                onChange={(e) => setExpectedTotal(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>

          <div className="w-72">
            <Field label={tr.imports.file}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-white"
              />
            </Field>
          </div>

          <Button
            disabled={!file || !cutoffDate || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? tr.imports.uploading : tr.imports.upload}
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {done ? (
        <div className="mb-6">
          <Alert tone="info">{done}</Alert>
        </div>
      ) : null}

      {report ? (
        <Card>
          <p className="mb-4 text-sm font-medium text-navy-900">{tr.wizard.report}</p>

          <div className="mb-4 grid gap-4 sm:grid-cols-4">
            <Stat
              label={tr.wizard.imported}
              value={money(report.importedTotal)}
              tone={balanceTone(report.importedTotal)}
            />
            <Stat
              label={tr.wizard.expected}
              value={report.expectedTotal ? money(report.expectedTotal) : '—'}
            />
            <Stat
              label={tr.wizard.difference}
              value={report.difference ? money(report.difference) : '—'}
              tone={report.matches ? 'text-credit' : 'text-debit'}
            />
            <Stat label={tr.wizard.newAccounts} value={String(report.newAccounts)} />
          </div>

          <div className="mb-4">
            {report.matches ? (
              <Alert tone="info">{tr.wizard.matches}</Alert>
            ) : (
              <Alert>{tr.wizard.mismatch}</Alert>
            )}
          </div>

          <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-ink-200">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left">{tr.common.accountCode}</th>
                  <th className="px-3 py-2 text-left">{tr.common.status}</th>
                  <th className="px-3 py-2 text-right">{tr.transactions.amount}</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr key={line.rowNo} className="border-t border-ink-100">
                    <td className="px-3 py-1.5 font-mono text-xs">{line.accountCode}</td>
                    <td className="px-3 py-1.5">
                      {line.exists ? (
                        <Badge>{tr.wizard.existingAccounts}</Badge>
                      ) : (
                        <Badge tone="credit">{tr.wizard.newAccounts}</Badge>
                      )}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        line.type === 'DEBIT' ? 'text-debit' : 'text-credit'
                      }`}
                    >
                      {money(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={() => commit.mutate()}
            disabled={commit.isPending || (expectedTotal !== '' && !report.matches)}
          >
            {tr.wizard.commit}
          </Button>
        </Card>
      ) : null}
    </>
  );
}
