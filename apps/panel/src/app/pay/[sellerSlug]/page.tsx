'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';
import { money } from '@/lib/utils';

interface PublicSeller {
  name: string;
  slug: string;
  logoUrl: string | null;
  channels: { bankTransfer: boolean; cardPos: boolean };
}

interface GuestIntentResult {
  intent: { referenceCode: string; amount: string; expiresAt: string };
  bankAccounts: { bankName: string; iban: string; holderName: string }[];
  payment: {
    hostedUrl: string;
    method: string;
    fields: Record<string, string>;
    chargeAmount: string;
  } | null;
}

/**
 * §8 — misafir odeme sayfasi. Kimlik yok; cari kodu + tutar yeter.
 * KART FORMU YOKTUR: kart kanalinda kullanici saglayicinin hosted 3D sayfasina POST edilir
 * (kural #5 — PAN/CVV bu uygulamaya hic girmez).
 */
export default function GuestPayPage() {
  const { sellerSlug } = useParams<{ sellerSlug: string }>();
  const [form, setForm] = useState({ accountCode: '', amount: '', channel: 'BANK_TRANSFER' });
  const [error, setError] = useState<string | null>(null);

  const seller = useQuery({
    queryKey: ['public-seller', sellerSlug],
    queryFn: () => apiGet<PublicSeller>(`/collections/guest/${sellerSlug}`),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<GuestIntentResult>(`/collections/guest/${sellerSlug}`, {
        accountCode: form.accountCode,
        amount: form.amount,
        channel: form.channel,
      }),
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  if (seller.isError) {
    return (
      <main className="mx-auto max-w-md p-6">
        <Alert>{tr.guest.notFound}</Alert>
      </main>
    );
  }

  const result = create.data;

  return (
    <main className="mx-auto max-w-md p-6">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{seller.data?.name ?? '...'}</h1>
        <p className="mt-1 text-sm text-slate-500">{tr.guest.title}</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      {result ? (
        <PaymentInstructions result={result} />
      ) : (
        <Card>
          <div className="grid gap-4">
            <Field label={tr.guest.accountCode}>
              <Input
                className="font-mono"
                value={form.accountCode}
                onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))}
              />
            </Field>

            <Field label={tr.guest.amount}>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </Field>

            {seller.data?.channels.cardPos ? (
              <Field label={tr.collections.channel}>
                <Select
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                >
                  <option value="BANK_TRANSFER">{tr.guest.bankTransfer}</option>
                  <option value="CARD_POS">{tr.guest.card}</option>
                </Select>
              </Field>
            ) : null}

            <Button
              disabled={!form.accountCode || !form.amount || create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
            >
              {create.isPending ? tr.common.saving : tr.guest.submit}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}

function PaymentInstructions({ result }: { result: GuestIntentResult }) {
  const [copied, setCopied] = useState(false);

  // Kart: saglayicinin sayfasina POST. Alanlar imzalidir; biz yalniz tasiyiciyiz.
  if (result.payment) {
    return (
      <Card>
        <p className="mb-2 text-sm text-slate-700">{tr.guest.providerHint}</p>
        <p className="mb-4 text-2xl font-semibold tabular-nums text-slate-900">
          {money(result.payment.chargeAmount)}
        </p>
        <form method="POST" action={result.payment.hostedUrl}>
          {Object.entries(result.payment.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Button type="submit" className="w-full">
            {tr.guest.payAtProvider}
          </Button>
        </form>
      </Card>
    );
  }

  const account = result.bankAccounts[0];

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {tr.guest.referenceTitle}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-md bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900">
          {result.intent.referenceCode}
        </code>
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(result.intent.referenceCode);
            setCopied(true);
          }}
        >
          {copied ? tr.common.copied : tr.common.copy}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{tr.guest.referenceHint}</p>

      {account ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-900">{account.bankName}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-slate-700">{account.iban}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void navigator.clipboard.writeText(account.iban)}
            >
              {tr.common.copy}
            </Button>
          </div>
          <p className="text-xs text-slate-500">{account.holderName}</p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">{tr.collections.amount}</span>
        <Badge tone="green">{money(result.intent.amount)}</Badge>
      </div>
    </Card>
  );
}
