'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { sum, type MoneyString } from '@carinet/shared';
import { Card, PageHeader, Stat } from '@/components/ui';
import { ApiError, apiGetPaged } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type BuyerWithBalance } from '@/lib/types';
import { balanceTone, money } from '@/lib/utils';

/** Panel ozeti — rakamlar sunucuda turetilmis bakiyelerden gelir (kural #2: `balance` kolonu yok). */
export default function PanelHomePage() {
  const router = useRouter();

  const buyers = useQuery({
    queryKey: ['buyers', 'summary'],
    queryFn: () => apiGetPaged<BuyerWithBalance>('/buyers?limit=100'),
    retry: false,
  });

  // Oturum yoksa girise don (cookie httpOnly oldugu icin varligi ancak API'den anlasilir).
  useEffect(() => {
    if (buyers.error instanceof ApiError && buyers.error.code === 'UNAUTHORIZED') {
      router.push('/giris');
    }
  }, [buyers.error, router]);

  const rows = buyers.data?.data ?? [];
  const receivable: MoneyString = sum(rows.map((b) => b.balance.balance));
  const overLimit = rows.filter(
    (b) => Number(b.creditLimit) > 0 && Number(b.balance.balance) > Number(b.creditLimit),
  );

  return (
    <>
      <PageHeader title={tr.dashboard.title} description={tr.buyers.description} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={tr.dashboard.accountCount} value={String(buyers.data?.meta.total ?? 0)} />
        <Stat
          label={tr.dashboard.totalReceivable}
          value={money(receivable)}
          tone={balanceTone(receivable)}
        />
        <Stat
          label={tr.dashboard.overLimit}
          value={String(overLimit.length)}
          tone={overLimit.length > 0 ? 'text-red-600' : undefined}
        />
      </div>

      <Card className="mt-6">
        <p className="mb-3 text-sm font-medium text-slate-900">{tr.dashboard.buyerAccounts}</p>
        {buyers.isLoading ? (
          <p className="text-sm text-slate-500">{tr.common.loading}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">{tr.common.empty}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {rows.slice(0, 8).map((buyer) => (
              <li key={buyer.id} className="flex items-center justify-between py-2">
                <span className="text-slate-700">
                  <span className="font-mono text-xs text-slate-500">{buyer.accountCode}</span>{' '}
                  {buyer.title}
                </span>
                <span className={`tabular-nums ${balanceTone(buyer.balance.balance)}`}>
                  {money(buyer.balance.balance)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
