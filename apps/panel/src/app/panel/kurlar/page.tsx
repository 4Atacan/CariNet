'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Card, PageHeader, Stat } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type ExchangeRate } from '@/lib/types';
import { trDate } from '@/lib/utils';

export default function RatesPage() {
  const latest = useQuery({
    queryKey: ['rates', 'latest'],
    queryFn: () => apiGet<ExchangeRate[]>('/exchange-rates/latest'),
  });

  const history = useQuery({
    queryKey: ['rates', 'history'],
    queryFn: () => apiGet<ExchangeRate[]>('/exchange-rates'),
  });

  const rows = latest.data ?? [];

  return (
    <>
      <PageHeader title={tr.rates.title} description={tr.rates.description} />

      <Alert tone="info">{tr.rates.hint}</Alert>

      <div className="my-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map((rate) => (
          <Stat
            key={rate.currencyCode}
            label={`${rate.currencyCode} · ${trDate(rate.date)}`}
            value={Number(rate.rate).toLocaleString('tr-TR', { minimumFractionDigits: 4 })}
          />
        ))}
        {rows.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">{tr.common.empty}</p>
          </Card>
        ) : null}
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="py-2">{tr.rates.date}</th>
              <th>{tr.rates.currency}</th>
              <th className="text-right">{tr.rates.rate}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(history.data ?? []).map((rate) => (
              <tr key={`${rate.date}-${rate.currencyCode}`}>
                <td className="py-1.5">{trDate(rate.date)}</td>
                <td className="font-medium text-slate-900">{rate.currencyCode}</td>
                <td className="text-right tabular-nums">
                  {Number(rate.rate).toLocaleString('tr-TR', { minimumFractionDigits: 4 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
