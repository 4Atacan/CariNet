'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useRef, useState } from 'react';
import { DataTable } from '@/components/data-table';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Stat,
} from '@/components/ui';
import { ApiError, apiGetPaged, apiPost, apiUpload, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import {
  type BulkConfirmResult,
  type BuyerWithBalance,
  type CollectIntent,
  type StatementImport,
} from '@/lib/types';
import { money, trDate } from '@/lib/utils';

const LIMIT = 20;

/** Toplu onayda bir satir ya bir talebe ya da bir cariye baglanir (§8). */
interface BulkMatch {
  rowId: string;
  intentId?: string;
  buyerAccountId?: string;
}

export default function CollectionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<CollectIntent | null>(null);
  const [statement, setStatement] = useState<StatementImport | null>(null);

  const intents = useQuery({
    queryKey: ['intents', page, status],
    queryFn: () =>
      apiGetPaged<CollectIntent>(`/collections/intents${qs({ page, limit: LIMIT, status })}`),
  });

  const buyers = useQuery({
    queryKey: ['buyers', 'all'],
    queryFn: () => apiGetPaged<BuyerWithBalance>('/buyers?limit=100'),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['intents'] });
    await queryClient.invalidateQueries({ queryKey: ['buyers'] });
  };

  const columns: ColumnDef<CollectIntent, unknown>[] = [
    {
      header: tr.common.buyer,
      cell: (c) => (
        <span>
          <span className="font-mono text-xs text-ink-600">
            {c.row.original.buyerAccount?.accountCode ?? '—'}
          </span>
          <span className="block">{c.row.original.buyerAccount?.title ?? '—'}</span>
        </span>
      ),
    },
    {
      header: tr.collections.reference,
      cell: (c) => (
        <button
          type="button"
          className="font-mono text-xs text-navy-900 underline-offset-2 hover:underline"
          onClick={() => void navigator.clipboard.writeText(c.row.original.referenceCode)}
          title={tr.common.copy}
        >
          {c.row.original.referenceCode}
        </button>
      ),
    },
    {
      header: tr.collections.amount,
      cell: (c) => <span className="tabular-nums font-medium">{money(c.row.original.amount)}</span>,
    },
    {
      header: tr.collections.channel,
      cell: (c) => (
        <Badge tone={c.row.original.channel === 'CARD_POS' ? 'brand' : 'credit'}>
          {tr.collections.channels[c.row.original.channel]}
        </Badge>
      ),
    },
    {
      header: tr.common.status,
      cell: (c) => {
        const s = c.row.original.status;
        const tone = s === 'CONFIRMED' ? 'credit' : s === 'PENDING' ? 'warn' : 'neutral';
        return <Badge tone={tone}>{tr.collections.statuses[s]}</Badge>;
      },
    },
    {
      header: tr.collections.expiresAt,
      cell: (c) => <span className="text-xs">{trDate(c.row.original.expiresAt)}</span>,
    },
    {
      header: tr.common.actions,
      cell: (c) =>
        c.row.original.status === 'PENDING' ? (
          <Button size="sm" onClick={() => setConfirming(c.row.original)}>
            {tr.collections.confirm}
          </Button>
        ) : null,
    },
  ];

  const rows = intents.data?.data ?? [];
  const pendingTotal = rows
    .filter((r) => r.status === 'PENDING')
    .reduce((acc, r) => acc + Number(r.amount), 0);

  return (
    <>
      <PageHeader title={tr.collections.title} description={tr.collections.description} />

      {error ? <Alert>{error}</Alert> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={tr.collections.pending} value={String(rows.length)} />
        <Stat label={tr.collections.amount} value={money(pendingTotal.toFixed(2))} />
        <Stat
          label={tr.collections.skippedOutgoing}
          value={String(statement?.skippedOutgoing ?? 0)}
        />
      </div>

      <StatementCard
        onLoaded={setStatement}
        onError={setError}
        statement={statement}
        buyers={buyers.data?.data ?? []}
        onConfirmed={async () => {
          setStatement(null);
          await refresh();
        }}
      />

      <Card className="mb-4">
        <div className="flex items-end gap-3">
          <Field label={tr.common.status}>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="PENDING">{tr.collections.statuses.PENDING}</option>
              <option value="CONFIRMED">{tr.collections.statuses.CONFIRMED}</option>
              <option value="EXPIRED">{tr.collections.statuses.EXPIRED}</option>
              <option value="CANCELLED">{tr.collections.statuses.CANCELLED}</option>
            </Select>
          </Field>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        page={page}
        limit={LIMIT}
        total={intents.data?.meta.total ?? 0}
        onPageChange={setPage}
        isLoading={intents.isLoading}
      />

      {confirming ? (
        <ConfirmDialog
          intent={confirming}
          onClose={() => setConfirming(null)}
          onDone={async () => {
            setConfirming(null);
            await refresh();
          }}
          onError={setError}
        />
      ) : null}
    </>
  );
}

/** §8 — manuel onay. Gerceklesen tutar farkliysa kalan icin yeni talep acilir. */
function ConfirmDialog({
  intent,
  onClose,
  onDone,
  onError,
}: {
  intent: CollectIntent;
  onClose: () => void;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const confirm = useMutation({
    mutationFn: () =>
      apiPost(`/collections/intents/${intent.id}/confirm`, {
        ...(amount ? { amount } : {}),
        ...(note ? { note } : {}),
      }),
    onSuccess: onDone,
    onError: (e) => onError(e instanceof ApiError ? e.message : tr.common.error),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
      <Card className="w-full max-w-md">
        <p className="mb-1 text-sm font-medium text-navy-900">{tr.collections.confirmTitle}</p>
        <p className="mb-4 font-mono text-xs text-ink-600">{intent.referenceCode}</p>

        <div className="mb-4 grid gap-3">
          <Stat label={tr.collections.amount} value={money(intent.amount)} />
          <Field label={tr.collections.actualAmount}>
            <Input
              inputMode="decimal"
              placeholder={intent.amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <p className="text-xs text-ink-600">{tr.collections.partialHint}</p>
          <Field label={tr.collections.note}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {tr.common.cancel}
          </Button>
          <Button disabled={confirm.isPending} onClick={() => confirm.mutate()}>
            {confirm.isPending ? tr.common.saving : tr.collections.confirm}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** §8 Kanal 1 — ekstre yukle → otomatik eslestirme onerisi → insan onayi → toplu onay. */
function StatementCard({
  statement,
  buyers,
  onLoaded,
  onConfirmed,
  onError,
}: {
  statement: StatementImport | null;
  buyers: BuyerWithBalance[];
  onLoaded: (data: StatementImport) => void;
  onConfirmed: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiUpload<StatementImport>('/collections/statement-import', form);
    },
    onSuccess: (data) => {
      setSelection({});
      onLoaded(data);
    },
    onError: (e) => onError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const confirm = useMutation({
    mutationFn: (matches: BulkMatch[]) =>
      apiPost<BulkConfirmResult>(`/collections/statement-import/${statement!.batchId}/confirm`, {
        matches,
      }),
    onSuccess: onConfirmed,
    onError: (e) => onError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const submit = () => {
    if (!statement) return;

    const matches: BulkMatch[] = [];
    for (const row of statement.rows) {
      if (row.matchedIntentId) continue; // zaten islenmis satir tekrar gonderilmez

      const suggestion = statement.matches.find((m) => m.rowId === row.id);
      const chosen = selection[row.id];

      // Kullanici cari sectiyse o kazanir; yoksa sistemin buldugu talep kullanilir.
      if (chosen) matches.push({ rowId: row.id, buyerAccountId: chosen });
      else if (suggestion?.intentId) matches.push({ rowId: row.id, intentId: suggestion.intentId });
      else if (suggestion?.buyerAccountId) {
        matches.push({ rowId: row.id, buyerAccountId: suggestion.buyerAccountId });
      }
    }

    if (matches.length > 0) confirm.mutate(matches);
  };

  return (
    <Card className="mb-6">
      <p className="mb-1 text-sm font-medium text-navy-900">{tr.collections.statement}</p>
      <p className="mb-4 text-xs text-ink-600">{tr.collections.statementHint}</p>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-sm file:text-white"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
          }}
        />
        {upload.isPending ? (
          <span className="text-xs text-ink-600">{tr.imports.uploading}</span>
        ) : null}
      </div>

      {statement ? (
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-200 text-left text-xs text-ink-600">
              <tr>
                <th className="py-2">{tr.common.date}</th>
                <th>{tr.transactions.description}</th>
                <th className="text-right">{tr.collections.amount}</th>
                <th>{tr.collections.match}</th>
                <th>{tr.common.buyer}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {statement.rows.map((row) => {
                const match = statement.matches.find((m) => m.rowId === row.id);
                const tone =
                  match?.confidence === 'EXACT'
                    ? 'credit'
                    : match?.confidence === 'SUGGESTED'
                      ? 'warn'
                      : 'neutral';

                return (
                  <tr key={row.id}>
                    <td className="py-2 text-xs">{trDate(row.txDate)}</td>
                    <td className="max-w-xs truncate text-xs text-ink-700" title={row.description}>
                      {row.description}
                    </td>
                    <td className="text-right tabular-nums">{money(row.amount)}</td>
                    <td>
                      {row.matchedIntentId ? (
                        <Badge tone="neutral">{tr.collections.matched}</Badge>
                      ) : (
                        <span>
                          <Badge tone={tone}>
                            {tr.collections.confidence[match?.confidence ?? 'NONE']}
                          </Badge>
                          <span className="mt-1 block text-[11px] text-ink-600">
                            {match?.reason}
                          </span>
                        </span>
                      )}
                    </td>
                    <td>
                      {row.matchedIntentId ? null : match?.intentId ? (
                        <span className="text-xs text-ink-700">{match.buyerAccountLabel}</span>
                      ) : (
                        <Select
                          value={selection[row.id] ?? match?.buyerAccountId ?? ''}
                          onChange={(e) =>
                            setSelection((s) => ({ ...s, [row.id]: e.target.value }))
                          }
                        >
                          <option value="">{tr.collections.selectAccount}</option>
                          {buyers.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.accountCode} · {b.title}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <Button disabled={confirm.isPending} onClick={submit}>
              {confirm.isPending ? tr.common.saving : tr.collections.bulkConfirm}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
