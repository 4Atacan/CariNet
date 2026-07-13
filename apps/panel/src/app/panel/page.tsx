'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type AuthenticatedUser, type MembershipSummary, formatMoney } from '@carinet/shared';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';

interface MeResponse extends AuthenticatedUser {
  memberships: MembershipSummary[];
}

interface BuyerAccountRow {
  id: string;
  accountCode: string;
  title: string;
  creditLimit: string;
  representative: { fullName: string } | null;
}

export default function PanelPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<MeResponse>('/auth/me'),
    retry: false,
  });

  const buyers = useQuery({
    queryKey: ['buyers'],
    queryFn: () => apiGet<BuyerAccountRow[]>('/buyers?limit=100'),
    retry: false,
    enabled: me.isSuccess,
  });

  const logout = useMutation({
    mutationFn: () => apiPost<{ ok: true }>('/auth/logout', {}),
    onSuccess: () => {
      queryClient.clear();
      router.push('/giris');
    },
  });

  // Oturum yoksa girise don (cookie httpOnly oldugu icin varligi API'den anlasilir).
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.code === 'UNAUTHORIZED') {
      router.push('/giris');
    }
  }, [me.error, router]);

  if (me.isLoading) return <Centered>{tr.common.loading}</Centered>;
  if (!me.data) return <Centered>{tr.common.loading}</Centered>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{tr.dashboard.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr.dashboard.welcome}, {me.data.fullName}
          </p>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          {tr.dashboard.logout}
        </button>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          {tr.dashboard.memberships}
        </h2>
        <ul className="space-y-2">
          {me.data.memberships.map((m) => (
            <li
              key={m.membershipId}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <span className="font-medium text-slate-900">{m.sellerName}</span>
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {m.role}
              </span>
              {m.accountCode ? (
                <span className="ml-2 text-slate-500">
                  {tr.common.accountCode}: {m.accountCode}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          {tr.dashboard.buyerAccounts}
        </h2>
        {buyers.isError ? (
          <p className="text-sm text-slate-500">{tr.dashboard.empty}</p>
        ) : (
          <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2">{tr.common.accountCode}</th>
                <th className="px-4 py-2">{tr.common.title}</th>
                <th className="px-4 py-2">{tr.common.representative}</th>
                <th className="px-4 py-2 text-right">{tr.common.creditLimit}</th>
              </tr>
            </thead>
            <tbody>
              {(buyers.data ?? []).map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">{b.accountCode}</td>
                  <td className="px-4 py-2">{b.title}</td>
                  <td className="px-4 py-2 text-slate-500">{b.representative?.fullName ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(b.creditLimit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      {children}
    </div>
  );
}
