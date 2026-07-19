'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';

interface Seller {
  id: string;
  name: string;
  slug: string;
  sellerNo: number;
  isActive: boolean;
  memberCount: number;
  buyerCount: number;
}
interface InviteResult {
  url: string;
  expiresAt: string;
}

/**
 * Platform yonetimi — PLATFORM_ADMIN alani.
 *
 * `/panel` altinda DEGIL: o duzen tenant baglami (aktif satici) bekler, platform admininin
 * ise uyeligi yoktur (§6.2 — uyelik varsa pickMembership her zaman uyelik rolunu verir,
 * yani platform rolu jetona hic yansimaz). Bu yuzden ayri bir kok ve kendi duzeni.
 */
export default function PlatformPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', slug: '' });
  const [invite, setInvite] = useState<{ sellerName: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sellers = useQuery({
    queryKey: ['platform', 'sellers'],
    queryFn: () => apiGet<Seller[]>('/platform/sellers'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform', 'sellers'] });
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : tr.common.error);

  const createSeller = useMutation({
    mutationFn: () => apiPost<Seller>('/platform/sellers', form),
    onSuccess: async () => {
      setForm({ name: '', slug: '' });
      setError(null);
      await invalidate();
    },
    onError: fail,
  });

  const toggleActive = useMutation({
    mutationFn: (s: Seller) =>
      apiPatch(`/platform/sellers/${s.id}/active`, { isActive: !s.isActive }),
    onSuccess: invalidate,
    onError: fail,
  });

  const makeInvite = useMutation({
    mutationFn: (s: Seller) =>
      apiPost<InviteResult>('/auth/seller-invites', { sellerId: s.id, role: 'ADMIN' }).then(
        (r) => ({ sellerName: s.name, url: r.url }),
      ),
    // Baglanti YALNIZ burada bir kez doner (sunucuda hash'i saklanir) → ekranda tutulur.
    onSuccess: (r) => {
      setError(null);
      setInvite(r);
    },
    onError: fail,
  });

  const logout = useMutation({
    mutationFn: () => apiPost('/auth/logout', {}),
    onSettled: () => router.push('/giris'),
  });

  const fullUrl = (path: string) =>
    typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  return (
    <main className="min-h-screen bg-ink-100">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Image
            src="/brand/carinet-logo.png"
            alt={tr.app.name}
            width={933}
            height={234}
            priority
            unoptimized
            className="h-6 w-auto"
          />
          <div className="flex items-center gap-4 text-sm">
            <Link href="/hesap" className="text-ink-700 hover:text-navy-900">
              {tr.platform.account}
            </Link>
            <button onClick={() => logout.mutate()} className="text-ink-700 hover:text-debit">
              {tr.platform.logout}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{tr.platform.title}</h1>
        <p className="mt-1 mb-8 text-sm text-ink-600">{tr.platform.subtitle}</p>

        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-md border-l-[3px] border-debit bg-debit-soft p-3 text-sm text-debit"
          >
            {error}
          </p>
        ) : null}

        {invite ? (
          <div className="mb-6 rounded-card border border-gold-500/40 bg-gold-500/5 p-4">
            <p className="text-sm font-medium text-navy-900">
              {invite.sellerName} — {tr.platform.inviteReady}
            </p>
            <input
              readOnly
              value={fullUrl(invite.url)}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 h-10 w-full rounded-md border border-ink-300 bg-white px-3 font-mono text-xs text-navy-900"
            />
            <p className="mt-2 text-xs text-ink-600">{tr.platform.inviteHint}</p>
          </div>
        ) : null}

        {/* Yeni satici */}
        <section className="mb-8 rounded-card border border-ink-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-navy-900">{tr.platform.newSeller}</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-navy-900">
                {tr.platform.name}
              </span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-navy-900">
                {tr.platform.slug}
              </span>
              <input
                className={`${inputClass} font-mono`}
                placeholder="anadolu-gida"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </label>
            <button
              onClick={() => createSeller.mutate()}
              disabled={createSeller.isPending || form.name.length < 2 || form.slug.length < 2}
              className="h-10 rounded-md bg-navy-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
            >
              {createSeller.isPending ? tr.platform.creating : tr.platform.create}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">{tr.platform.slugHint}</p>
        </section>

        {/* Satici listesi */}
        <section className="overflow-hidden rounded-card border border-ink-200 bg-white">
          <h2 className="border-b border-ink-200 px-5 py-3 text-sm font-semibold text-navy-900">
            {tr.platform.sellers}
          </h2>
          {sellers.isLoading ? (
            <p className="px-5 py-6 text-sm text-ink-600">{tr.common.loading}</p>
          ) : (sellers.data ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-600">{tr.platform.empty}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {(sellers.data ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="w-10 shrink-0 font-mono text-xs text-ink-500 tabular-nums">
                    #{s.sellerNo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-navy-900">
                      {s.name}
                    </span>
                    <span className="block font-mono text-xs text-ink-500">/{s.slug}</span>
                  </span>
                  <span className="text-xs text-ink-600 tabular-nums">
                    {s.memberCount} {tr.platform.members} · {s.buyerCount} {tr.platform.buyers}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.isActive ? 'bg-credit-soft text-credit' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {s.isActive ? tr.platform.active : tr.platform.passive}
                  </span>
                  <button
                    onClick={() => makeInvite.mutate(s)}
                    disabled={makeInvite.isPending}
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-medium text-navy-900 transition-colors hover:bg-ink-100 disabled:opacity-50"
                  >
                    {tr.platform.invite}
                  </button>
                  <button
                    onClick={() => toggleActive.mutate(s)}
                    disabled={toggleActive.isPending}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:text-debit disabled:opacity-50"
                  >
                    {s.isActive ? tr.platform.deactivate : tr.platform.activate}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

const inputClass =
  'h-10 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-navy-900 outline-none transition-colors focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15';
