'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui deseni (Radix + cva + Tailwind) — bilesenler projede yasar, paket bagimliligi degildir.
 * Metinler BURADA sabitlenmez; cagiran taraf `tr` sozlugunden gecirir (§12).
 *
 * Renkler globals.css'teki marka belirteclerinden gelir (navy/gold/ink + debit/credit/warn).
 * Tailwind'in varsayilan slate/red/emerald'i KULLANILMAZ — logoyla akraba olmayan bir palet
 * markayi silip her panele benzeten seydi.
 */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950',
        outline:
          'border border-ink-300 bg-white text-navy-900 hover:border-ink-400 hover:bg-ink-50',
        ghost: 'text-ink-700 hover:bg-ink-100 hover:text-navy-900',
        danger: 'bg-debit text-white hover:brightness-110 active:brightness-95',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

const fieldBase =
  'h-9 w-full rounded-md border border-ink-300 bg-white text-sm text-navy-900 outline-none transition-colors placeholder:text-ink-400 focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15 disabled:bg-ink-100 disabled:text-ink-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'px-3 py-1', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, 'px-2', className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Field({
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
      <span className="mb-1 block text-sm font-medium text-navy-900">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs font-medium text-debit">{error}</span> : null}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-card border border-ink-200 bg-white p-5 shadow-[0_1px_2px_rgb(21_42_85/0.04)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <p className="text-[0.6875rem] font-semibold tracking-wider text-ink-500 uppercase">
        {label}
      </p>
      <p
        data-numeric
        className={cn('mt-1.5 text-2xl font-bold tracking-tight', tone ?? 'text-navy-900')}
      >
        {value}
      </p>
    </Card>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'credit' | 'debit' | 'warn' | 'brand';
}) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
    credit: 'bg-credit-soft text-credit ring-credit/20',
    debit: 'bg-debit-soft text-debit ring-debit/20',
    warn: 'bg-warn-soft text-warn ring-warn/20',
    brand: 'bg-navy-50 text-navy-800 ring-navy-200',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border-l-[3px] p-3 text-sm',
        tone === 'error'
          ? 'border-debit bg-debit-soft text-debit'
          : 'border-navy-600 bg-navy-50 text-navy-800',
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
