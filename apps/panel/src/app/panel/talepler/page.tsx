'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { ApiError, apiGetPaged, apiPost, qs } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type RequestStatus, type SupportRequest } from '@/lib/types';
import { trDate } from '@/lib/utils';

const TONE: Record<RequestStatus, 'warn' | 'credit' | 'neutral'> = {
  OPEN: 'warn',
  IN_PROGRESS: 'warn',
  RESOLVED: 'credit',
  CLOSED: 'neutral',
};

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const requests = useQuery({
    queryKey: ['requests', status],
    queryFn: () => apiGetPaged<SupportRequest>(`/requests${qs({ limit: 50, status })}`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['requests'] });

  /** Yanit → aliciya bildirim + push gider. */
  const reply = useMutation({
    mutationFn: (p: { id: string; reply: string }) =>
      apiPost(`/requests/${p.id}/reply`, { reply: p.reply, status: 'RESOLVED' }),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const close = useMutation({
    mutationFn: (id: string) => apiPost(`/requests/${id}/close`, {}),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  return (
    <>
      <PageHeader title={tr.requests.title} description={tr.requests.description} />

      {error ? <Alert>{error}</Alert> : null}

      <Card className="mb-4">
        <div className="w-64">
          <Field label={tr.common.status}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{tr.common.select}</option>
              {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as RequestStatus[]).map((s) => (
                <option key={s} value={s}>
                  {tr.requests.statuses[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="grid gap-4">
        {(requests.data?.data ?? []).map((request) => (
          <Card key={request.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-navy-900">{request.subject}</p>
                  <Badge tone={TONE[request.status]}>{tr.requests.statuses[request.status]}</Badge>
                  <Badge tone="neutral">{tr.requests.types[request.type]}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-600">
                  {request.buyerAccount?.accountCode} · {request.buyerAccount?.title} ·{' '}
                  {trDate(request.createdAt)}
                </p>
                <p className="mt-2 text-sm text-ink-800">{request.body}</p>

                {request.reply ? (
                  <div className="mt-3 rounded-md border-l-2 border-credit bg-credit-soft p-3">
                    <p className="text-xs font-medium text-credit">{tr.requests.replied}</p>
                    <p className="text-sm text-credit">{request.reply}</p>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder={tr.requests.replyPlaceholder}
                      value={replies[request.id] ?? ''}
                      onChange={(e) => setReplies((r) => ({ ...r, [request.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      disabled={!replies[request.id] || reply.isPending}
                      onClick={() => reply.mutate({ id: request.id, reply: replies[request.id]! })}
                    >
                      {tr.requests.reply}
                    </Button>
                  </div>
                )}
              </div>

              {request.status !== 'CLOSED' ? (
                <Button size="sm" variant="ghost" onClick={() => close.mutate(request.id)}>
                  {tr.requests.close}
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
        {(requests.data?.data ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-ink-600">{tr.common.empty}</p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
