'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { ApiError, apiDelete, apiGet, apiPost, apiPut, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type BankAccount, type PosConfig } from '@/lib/types';

export default function SettingsPage() {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={tr.settings.title} description={tr.settings.description} />
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <BankAccountsCard onError={setError} />
        <PosCard onError={setError} />
      </div>
    </>
  );
}

/** §11.3 — IBAN degisikligi kritik islem: 2FA kodu istenir, audit yazilir. */
function BankAccountsCard({ onError }: { onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ bankName: '', iban: '', holderName: '', totp: '' });

  const accounts = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => apiGet<BankAccount[]>('/sellers/bank-accounts'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/sellers/bank-accounts', {
        bankName: form.bankName,
        iban: form.iban,
        holderName: form.holderName,
        ...(form.totp ? { totp: form.totp } : {}),
      }),
    onSuccess: async () => {
      setForm({ bankName: '', iban: '', holderName: '', totp: '' });
      await invalidate();
    },
    onError: (e) => onError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiDelete(`/sellers/bank-accounts/${id}${qs({ totp: form.totp })}`),
    onSuccess: invalidate,
    onError: (e) => onError(e instanceof ApiError ? e.message : tr.common.error),
  });

  return (
    <Card>
      <p className="mb-3 text-sm font-medium text-slate-900">{tr.settings.bankAccounts}</p>

      <ul className="mb-4 divide-y divide-slate-100 text-sm">
        {(accounts.data ?? []).map((account) => (
          <li key={account.id} className="flex items-start justify-between gap-3 py-2">
            <span>
              <span className="font-medium text-slate-900">{account.bankName}</span>
              {!account.isActive ? <Badge tone="slate">{tr.buyers.inactive}</Badge> : null}
              <span className="block font-mono text-xs text-slate-500">{account.iban}</span>
              <span className="block text-xs text-slate-500">{account.holderName}</span>
            </span>
            {account.isActive ? (
              <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(account.id)}>
                {tr.settings.deactivate}
              </Button>
            ) : null}
          </li>
        ))}
        {(accounts.data ?? []).length === 0 ? (
          <li className="py-2 text-slate-500">{tr.common.empty}</li>
        ) : null}
      </ul>

      <div className="grid gap-3">
        <Field label={tr.settings.bankName}>
          <Input
            value={form.bankName}
            onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
          />
        </Field>
        <Field label={tr.settings.iban}>
          <Input
            className="font-mono"
            placeholder="TR.."
            value={form.iban}
            onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
          />
        </Field>
        <Field label={tr.settings.holderName}>
          <Input
            value={form.holderName}
            onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))}
          />
        </Field>
        <Field label={tr.settings.totp} hint={tr.settings.totpHint}>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={form.totp}
            onChange={(e) => setForm((f) => ({ ...f, totp: e.target.value }))}
          />
        </Field>
        <Button
          disabled={!form.bankName || !form.iban || !form.holderName || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? tr.common.saving : tr.settings.addBank}
        </Button>
      </div>
    </Card>
  );
}

/** §8 Kanal 2 / kural #5 — saticinin KENDI POS'u. Anahtarlar maskeli gorunur, AES ile saklanir. */
function PosCard({ onError }: { onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    provider: 'SANDBOX',
    merchantId: '',
    apiKey: '',
    secret: '',
    isActive: true,
    totp: '',
  });

  const config = useQuery({
    queryKey: ['pos-config'],
    queryFn: () => apiGet<PosConfig | null>('/sellers/pos-config'),
  });

  const providers = useQuery({
    queryKey: ['pos-providers'],
    queryFn: () => apiGet<string[]>('/sellers/pos-providers'),
  });

  const save = useMutation({
    mutationFn: () =>
      apiPut('/sellers/pos-config', {
        provider: form.provider,
        merchantId: form.merchantId,
        apiKey: form.apiKey,
        secret: form.secret,
        isActive: form.isActive,
        ...(form.totp ? { totp: form.totp } : {}),
      }),
    onSuccess: async () => {
      setForm((f) => ({ ...f, apiKey: '', secret: '', totp: '' }));
      await queryClient.invalidateQueries({ queryKey: ['pos-config'] });
    },
    onError: (e) => onError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const current = config.data;

  return (
    <Card>
      <p className="mb-1 text-sm font-medium text-slate-900">{tr.settings.pos}</p>
      <p className="mb-4 text-xs text-slate-500">{tr.settings.posHint}</p>

      {current ? (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-900">{current.provider}</span>
            <Badge tone={current.isActive ? 'green' : 'slate'}>
              {current.isActive ? tr.settings.active : tr.buyers.inactive}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {tr.settings.merchantId}: {current.merchantId}
          </p>
          <p className="font-mono text-xs text-slate-500">
            {tr.settings.apiKey}: {current.apiKeyMasked}
          </p>
          <p className="font-mono text-xs text-slate-500">
            {tr.settings.secret}: {current.secretMasked}
          </p>
        </div>
      ) : (
        <Alert tone="info">{tr.settings.posEmpty}</Alert>
      )}

      <div className="grid gap-3">
        <Field label={tr.settings.provider}>
          <Select
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          >
            {(providers.data ?? ['SANDBOX']).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr.settings.merchantId}>
          <Input
            value={form.merchantId}
            onChange={(e) => setForm((f) => ({ ...f, merchantId: e.target.value }))}
          />
        </Field>
        <Field label={tr.settings.apiKey}>
          <Input
            type="password"
            autoComplete="off"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
          />
        </Field>
        <Field label={tr.settings.secret}>
          <Input
            type="password"
            autoComplete="off"
            value={form.secret}
            onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
          />
        </Field>
        <Field label={tr.settings.totp} hint={tr.settings.totpHint}>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={form.totp}
            onChange={(e) => setForm((f) => ({ ...f, totp: e.target.value }))}
          />
        </Field>
        <Button
          disabled={!form.merchantId || !form.apiKey || !form.secret || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? tr.common.saving : tr.settings.save}
        </Button>
      </div>
    </Card>
  );
}
