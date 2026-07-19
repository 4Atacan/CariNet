'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';

interface StartResponse {
  sellerName: string;
  role: 'ADMIN' | 'STAFF';
  otpauthUrl: string;
  secret: string;
}
interface CompleteResponse {
  backupCodes?: string[];
}

/**
 * Satici yoneticisi daveti — onboarding kilidini acan ekran.
 *
 * Kilit neydi: kural #11 SELLER_ADMIN'i 2FA'siz giristen men eder, ama 2FA kurulum ucu
 * giris yapmis olmayi ister. Bu akista hesap, TOTP kodu dogrulandiktan SONRA olusur;
 * boylece 2FA'siz bir yonetici hicbir an var olmaz.
 */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    passwordAgain: '',
    totp: '',
  });
  const [setup, setSetup] = useState<StartResponse | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : tr.common.error);

  const startStep = async () => {
    setError(null);
    if (form.password !== form.passwordAgain) return setError(tr.invite.mismatch);
    setBusy(true);
    try {
      setSetup(
        await apiPost<StartResponse>('/auth/seller-invite/start', {
          token,
          password: form.password,
        }),
      );
      setStep(2);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const finishStep = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await apiPost<CompleteResponse>('/auth/seller-invite/complete', {
        token,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        totp: form.totp,
      });
      // Kodlar yalniz burada bir kez doner — panele gecmeden once gosterilmeli.
      setBackupCodes(res.backupCodes ?? []);
      setStep(3);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-ink-100 px-6 py-12">
      <div className="w-full max-w-md">
        <Image
          src="/brand/carinet-logo.png"
          alt={tr.app.name}
          width={933}
          height={234}
          priority
          unoptimized
          className="mb-8 h-7 w-auto"
        />

        <div className="rounded-card border border-ink-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-navy-900">{tr.invite.title}</h1>
          {setup ? <p className="mt-1 text-sm text-ink-600">{setup.sellerName}</p> : null}

          <p className="mt-4 mb-6 text-xs text-ink-600">
            {step === 1 ? tr.invite.step1 : step === 2 ? tr.invite.step2 : ''}
          </p>

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-md border-l-[3px] border-debit bg-debit-soft p-3 text-sm text-debit"
            >
              {error}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <Field label={tr.invite.fullName}>
                <input
                  className={inputClass}
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </Field>
              <Field label={tr.invite.email}>
                <input
                  type="email"
                  autoComplete="username"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field label={tr.invite.password} hint={tr.invite.passwordHint}>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </Field>
              <Field label={tr.invite.passwordAgain}>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={form.passwordAgain}
                  onChange={(e) => setForm((f) => ({ ...f, passwordAgain: e.target.value }))}
                />
              </Field>
              <p className="text-xs text-ink-500">{tr.invite.twoFaWhy}</p>
              <button
                onClick={() => void startStep()}
                disabled={busy || !form.email || !form.fullName || !form.password}
                className={buttonClass}
              >
                {busy ? tr.invite.working : tr.invite.next}
              </button>
            </div>
          ) : null}

          {step === 2 && setup ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-navy-900">{tr.invite.scanTitle}</p>
              <p className="text-xs text-ink-600">{tr.invite.scanHelp}</p>

              {/*
                QR kodu YOK — kasitli. Cizmek icin bir QR kutuphanesi gerekiyor ve bu makinede
                paket kurulumu tekrar tekrar basarisiz oluyor (OneDrive/pnpm cakismasi);
                beyan edilmemis bir dolayli bagimliliga yaslanmak ise ilk lockfile
                degisiminde sessizce kirilirdi. Anahtari elle girmek her uygulamada desteklenir.
                Anahtar UCUNCU BIR SERVISE de gonderilmez (harici QR API'si kullanilmadi).
              */}
              <Field label={tr.invite.manualKey}>
                <input
                  readOnly
                  value={groupKey(setup.secret)}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`${inputClass} font-mono text-xs tracking-wider`}
                />
              </Field>

              {/* Telefondan aciliyorsa: dokununca kimlik dogrulayici uygulama dogrudan acilir. */}
              <a
                href={setup.otpauthUrl}
                className="block text-center text-xs text-navy-700 underline underline-offset-4 hover:text-navy-900"
              >
                {tr.invite.openApp}
              </a>

              <Field label={tr.invite.totp}>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className={`${inputClass} tracking-[0.3em] tabular-nums`}
                  value={form.totp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, totp: e.target.value.replace(/\D/g, '') }))
                  }
                />
              </Field>

              <button
                onClick={() => void finishStep()}
                disabled={busy || form.totp.length !== 6}
                className={buttonClass}
              >
                {busy ? tr.invite.working : tr.invite.finish}
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-navy-900">{tr.invite.backupTitle}</p>
              <p className="text-xs text-ink-600">{tr.invite.backupHelp}</p>
              <ul className="grid grid-cols-2 gap-2 rounded-md border border-ink-200 bg-ink-100 p-3 font-mono text-xs text-navy-900">
                {backupCodes.map((c) => (
                  <li key={c} className="tabular-nums">
                    {c}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  router.push('/panel');
                  router.refresh();
                }}
                className={buttonClass}
              >
                {tr.invite.backupAck}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/** Elle girisi kolaylastirmak icin anahtari 4'erli gruplar: yazarken yer kaybi olmasin. */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

const inputClass =
  'h-10 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-navy-900 outline-none transition-colors placeholder:text-ink-400 focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15';
const buttonClass =
  'w-full rounded-md bg-navy-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 disabled:opacity-50';

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
