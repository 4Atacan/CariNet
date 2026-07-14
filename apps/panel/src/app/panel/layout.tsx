'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  UserRound,
  Users,
  Wallet,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { tr } from '@/lib/tr';
import { cn } from '@/lib/utils';

interface Me {
  fullName: string;
  email: string | null;
  memberships: { kind: 'SELLER' | 'BUYER'; sellerName: string; role: string }[];
}

const NAV = [
  { href: '/panel', label: tr.nav.dashboard, icon: LayoutDashboard },
  { href: '/panel/cariler', label: tr.nav.buyers, icon: Users },
  { href: '/panel/hareketler', label: tr.nav.transactions, icon: ArrowRightLeft },
  { href: '/panel/faturalar', label: tr.nav.invoices, icon: FileText },
  { href: '/panel/raporlar', label: tr.nav.reports, icon: BarChart3 },
  { href: '/panel/tahsilat', label: tr.nav.collections, icon: Wallet },
  { href: '/panel/ice-aktarim', label: tr.nav.imports, icon: Upload },
  { href: '/panel/gecis-sihirbazi', label: tr.nav.wizard, icon: Wand2 },
  { href: '/panel/temsilciler', label: tr.nav.representatives, icon: UserRound },
  { href: '/panel/ayarlar', label: tr.nav.settings, icon: Settings },
] as const;

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiGet<Me>('/auth/me') });
  const sellerName = me.data?.memberships.find((m) => m.kind === 'SELLER')?.sellerName;

  const logout = useMutation({
    mutationFn: () => apiPost('/auth/logout', {}),
    onSettled: () => router.push('/giris'),
  });

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">{tr.app.name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {sellerName ?? tr.common.loading}
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/panel' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-slate-900 font-medium text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-3 pb-2 text-xs text-slate-500">{me.data?.fullName}</p>
          <button
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <LogOut size={16} />
            {tr.nav.logout}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
