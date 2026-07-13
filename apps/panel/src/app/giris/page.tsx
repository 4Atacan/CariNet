'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput, type LoginResponse } from '@carinet/shared';
import { ApiError, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await apiPost<LoginResponse>('/auth/login', values);
      // Tokenlar httpOnly cookie olarak dondu (kural #9) — JS'te saklamiyoruz.
      router.push('/panel');
      router.refresh();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : tr.login.genericError);
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{tr.app.name}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">{tr.login.title}</p>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={tr.login.email} error={errors.email?.message}>
            <input
              type="email"
              autoComplete="username"
              className={inputClass}
              {...register('email')}
            />
          </Field>

          <Field label={tr.login.password} error={errors.password?.message}>
            <input
              type="password"
              autoComplete="current-password"
              className={inputClass}
              {...register('password')}
            />
          </Field>

          <Field label={tr.login.totp} error={errors.totp?.message}>
            {/* 2FA kurulu degilse bos birakilir; bos string undefined'a cevrilir ki sema gecsin */}
            <input
              inputMode="numeric"
              placeholder="000000"
              className={inputClass}
              {...register('totp', { setValueAs: (v: string) => (v === '' ? undefined : v) })}
            />
          </Field>

          {serverError ? (
            <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {serverError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? tr.login.submitting : tr.login.submit}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
