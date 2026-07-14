'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { ApiError, apiDelete, apiGetPaged, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';
import { type Campaign } from '@/lib/types';
import { trDate } from '@/lib/utils';

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', startsAt: '', endsAt: '' });

  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiGetPaged<Campaign>('/campaigns?limit=50'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['campaigns'] });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/campaigns', {
        title: form.title,
        body: form.body,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      }),
    onSuccess: async () => {
      setForm({ title: '', body: '', startsAt: '', endsAt: '' });
      await refresh();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  /** Duyuru: alicilarin telefonuna push gider (payload hesap baglamli). */
  const announce = useMutation({
    mutationFn: (id: string) =>
      apiPost<{ notified: number; pushed: number }>(`/campaigns/${id}/announce`, {}),
    onSuccess: (data) => setResult(`${data.notified} ${tr.campaigns.announced}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/campaigns/${id}`),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof ApiError ? e.message : tr.common.error),
  });

  const statusOf = (c: Campaign): { label: string; tone: 'green' | 'slate' | 'amber' } => {
    const now = Date.now();
    if (new Date(c.endsAt).getTime() < now) return { label: tr.campaigns.ended, tone: 'slate' };
    if (new Date(c.startsAt).getTime() > now) {
      return { label: tr.campaigns.upcoming, tone: 'amber' };
    }
    return { label: tr.campaigns.active, tone: 'green' };
  };

  return (
    <>
      <PageHeader title={tr.campaigns.title} description={tr.campaigns.description} />

      {error ? <Alert>{error}</Alert> : null}
      {result ? <Alert tone="info">{result}</Alert> : null}

      <Card className="mb-6">
        <p className="mb-3 text-sm font-medium text-slate-900">{tr.campaigns.new}</p>
        <div className="grid gap-3">
          <Field label={tr.campaigns.campaignTitle}>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label={tr.campaigns.body}>
            <Input
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr.campaigns.startsAt}>
              <Input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </Field>
            <Field label={tr.campaigns.endsAt}>
              <Input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            disabled={
              !form.title || !form.body || !form.startsAt || !form.endsAt || create.isPending
            }
            onClick={() => create.mutate()}
          >
            {create.isPending ? tr.common.saving : tr.common.save}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4">
        {(campaigns.data?.data ?? []).map((campaign) => {
          const status = statusOf(campaign);
          return (
            <Card key={campaign.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{campaign.title}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{campaign.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {trDate(campaign.startsAt)} — {trDate(campaign.endsAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={announce.isPending}
                    onClick={() => announce.mutate(campaign.id)}
                  >
                    {announce.isPending ? tr.campaigns.announcing : tr.campaigns.announce}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(campaign.id)}>
                    {tr.campaigns.delete}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {(campaigns.data?.data ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">{tr.common.empty}</p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
