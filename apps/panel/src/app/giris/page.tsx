'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
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
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/*
       * Marka alani. Panelin geri kalani ACIK (okunacak veri var); giriste veri yok, o yuzden
       * marka burada cesur olabilir. Dar ekranda gizlenir — telefonda formu asagi itmesin.
       */}
      <section className="relative hidden overflow-hidden bg-navy-900 p-12 lg:flex lg:flex-col lg:justify-between">
        {/* Logonun isareti, dev ve tasan bir filigran. Dekoratif → aria-hidden. */}
        <Image
          src="/brand/carinet-mark-reverse.png"
          alt=""
          aria-hidden
          width={229}
          height={256}
          className="pointer-events-none absolute -right-16 -bottom-24 w-[28rem] opacity-[0.06]"
        />
        {/* Altin, lacivertin uzerinde ince bir isik cizgisi olarak — logodaki ikinci rengi hatirlatir. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
        />

        {/* Lacivert zemin icin ters varyant: yazi beyaz, isaretin altin/gri katmanlari korunur.
            `brightness-0 invert` denendi — logoyu tek beyaz lekeye cevirip "C"yi okunamaz yapiyordu. */}
        <Image
          src="/brand/carinet-logo-reverse.png"
          alt={tr.app.name}
          width={766}
          height={192}
          priority
          className="relative h-7 w-auto"
        />

        <div className="relative max-w-md">
          <p className="text-3xl leading-tight font-bold tracking-tight text-white text-balance">
            {tr.login.pitch}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-navy-200">{tr.login.pitchSub}</p>
        </div>

        <p className="relative text-xs text-navy-300">
          {tr.app.name} — {tr.app.tagline}
        </p>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Dar ekranda marka alani gizli — logo burada gorunur. */}
          <Image
            src="/brand/carinet-logo.png"
            alt={tr.app.name}
            width={383}
            height={96}
            className="mb-8 h-7 w-auto lg:hidden"
          />

          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{tr.login.title}</h1>
          <p className="mt-1.5 mb-8 text-sm text-ink-600">{tr.app.tagline}</p>

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

            <Field label={tr.login.totp} error={errors.totp?.message} hint={tr.login.totpHint}>
              {/* 2FA kurulu degilse bos birakilir; bos string undefined'a cevrilir ki sema gecsin */}
              <input
                inputMode="numeric"
                placeholder="000000"
                className={`${inputClass} tracking-[0.3em] tabular-nums`}
                {...register('totp', { setValueAs: (v: string) => (v === '' ? undefined : v) })}
              />
            </Field>

            {serverError ? (
              <p
                role="alert"
                className="rounded-md border-l-[3px] border-debit bg-debit-soft p-3 text-sm text-debit"
              >
                {serverError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-navy-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? tr.login.submitting : tr.login.submit}
            </button>
          </form>

          <a
            href="/gizlilik"
            className="mt-8 block text-center text-xs text-ink-500 underline-offset-4 transition-colors hover:text-navy-900 hover:underline"
          >
            {tr.login.privacy}
          </a>
        </div>
      </section>
    </main>
  );
}

const inputClass =
  'h-10 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-navy-900 outline-none transition-colors placeholder:text-ink-400 focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15';

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-900">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs font-medium text-debit">{error}</span> : null}
    </label>
  );
}
