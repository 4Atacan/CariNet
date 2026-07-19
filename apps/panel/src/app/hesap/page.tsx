'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';

interface Me {
  fullName: string;
  email: string | null;
  memberships: { kind: 'SELLER' | 'BUYER'; sellerName: string }[];
}

/**
 * Hesap ayarlari — parola degistirme.
 *
 * `/panel` altinda DEGIL: o duzen tenant baglami bekler, platform admininin uyeligi yoktur.
 * Parola degistirme her oturum sahibini ilgilendirdigi icin baglamsiz bir kokte durur.
 */
export default function AccountPage() {
  const router = useRouter();
  const [form, setForm] = useState({ current: '', next: '', nextAgain: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiGet<Me>('/auth/me') });
  const isSeller = (me.data?.memberships ?? []).some((m) => m.kind === 'SELLER');

  const change = useMutation({
    mutationFn: () =>
      apiPost('/auth/change-password', {
        currentPassword: form.current,
        newPassword: form.next,
      }),
    // Sunucu tum refresh ailelerini iptal eder (§6.3) → bu oturum da olur, girise donulur.
    onSuccess: () => {
      setError(null);
      setDone(true);
      setForm({ current: '', next: '', nextAgain: '' });
      setTimeout(() => router.push('/giris'), 4000);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const submit = () => {
    setError(null);
    if (form.next !== form.nextAgain) return setError(tr.invite.mismatch);
    change.mutate();
  };

  return (
    <main className="min-h-screen bg-ink-100">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Image
            src="/brand/carinet-logo.png"
            alt={tr.app.name}
            width={933}
            height={234}
            priority
            unoptimized
            className="h-6 w-auto"
          />
          {/* Nereden gelindigine gore geri donus: satici uyeligi varsa panel, yoksa yonetim. */}
          <Link
            href={isSeller ? '/panel' : '/yonetim'}
            className="text-sm text-ink-700 hover:text-navy-900"
          >
            {tr.common.back}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{tr.password.title}</h1>
        {me.data ? (
          <p className="mt-1 mb-8 text-sm text-ink-600">
            {me.data.fullName}
            {me.data.email ? ` · ${me.data.email}` : ''}
          </p>
        ) : null}

        {done ? (
          <p className="mb-6 rounded-md border-l-[3px] border-credit bg-credit-soft p-3 text-sm text-credit">
            {tr.password.done}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-md border-l-[3px] border-debit bg-debit-soft p-3 text-sm text-debit"
          >
            {error}
          </p>
        ) : null}

        <div className="max-w-sm space-y-4 rounded-card border border-ink-200 bg-white p-5">
          <Field label={tr.password.current}>
            <input
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={form.current}
              onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
            />
          </Field>
          <Field label={tr.password.next} hint={tr.invite.passwordHint}>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={form.next}
              onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
            />
          </Field>
          <Field label={tr.password.nextAgain}>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={form.nextAgain}
              onChange={(e) => setForm((f) => ({ ...f, nextAgain: e.target.value }))}
            />
          </Field>
          <button
            onClick={submit}
            disabled={change.isPending || done || !form.current || form.next.length < 10}
            className="w-full rounded-md bg-navy-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
          >
            {change.isPending ? tr.invite.working : tr.password.submit}
          </button>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  'h-10 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-navy-900 outline-none transition-colors focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-900">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}
