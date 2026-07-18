'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  BarChart3,
  Coins,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Megaphone,
  Package,
  Settings,
  Upload,
  UserRound,
  Users,
  Wallet,
  Wand2,
} from 'lucide-react';
import Image from 'next/image';
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

/**
 * Gruplanmis gezinme. Onceki hali 14 maddeyi duz liste yapiyordu: gunde 20 kez acilan "Cari
 * hesaplar" ile yilda bir acilan "Gecis sihirbazi" ayni agirliktaydi ve goz her seferinde tum
 * listeyi bastan tariyordu. Gruplar kullanim sikligina gore siralanir.
 */
const GROUPS = [
  {
    label: tr.nav.groupDaily,
    items: [
      { href: '/panel', label: tr.nav.dashboard, icon: LayoutDashboard },
      { href: '/panel/cariler', label: tr.nav.buyers, icon: Users },
      { href: '/panel/hareketler', label: tr.nav.transactions, icon: ArrowRightLeft },
      { href: '/panel/faturalar', label: tr.nav.invoices, icon: FileText },
      { href: '/panel/tahsilat', label: tr.nav.collections, icon: Wallet },
      { href: '/panel/raporlar', label: tr.nav.reports, icon: BarChart3 },
    ],
  },
  {
    label: tr.nav.groupCatalog,
    items: [
      { href: '/panel/urunler', label: tr.nav.products, icon: Package },
      { href: '/panel/kampanyalar', label: tr.nav.campaigns, icon: Megaphone },
      { href: '/panel/talepler', label: tr.nav.requests, icon: MessageSquare },
    ],
  },
  {
    label: tr.nav.groupSetup,
    items: [
      { href: '/panel/ice-aktarim', label: tr.nav.imports, icon: Upload },
      { href: '/panel/gecis-sihirbazi', label: tr.nav.wizard, icon: Wand2 },
      { href: '/panel/temsilciler', label: tr.nav.representatives, icon: UserRound },
      { href: '/panel/kurlar', label: tr.nav.rates, icon: Coins },
      { href: '/panel/ayarlar', label: tr.nav.settings, icon: Settings },
    ],
  },
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
    <div className="flex min-h-screen bg-ink-100">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
        <div className="flex h-16 shrink-0 items-center border-b border-ink-200 px-5">
          <Image
            src="/brand/carinet-logo.png"
            alt={tr.app.name}
            width={933}
            height={234}
            priority
            unoptimized
            className="h-6 w-auto"
          />
        </div>

        {/* Aktif satici baglami: coklu uyelikte (§6.2) hangi defterde oldugumuz her zaman gorunur. */}
        <div className="shrink-0 border-b border-ink-200 px-5 py-3">
          <p className="text-[0.6875rem] font-medium tracking-wide text-ink-500 uppercase">
            {tr.app.tagline}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-navy-900">
            {sellerName ?? tr.common.loading}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-ink-400 uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = href === '/panel' ? pathname === href : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        // Aktif durum: altin sol serit + acik lacivert zemin. Dolu koyu zemin
                        // yerine serit, cunku 14 maddede blok blok zemin gorsel gurultu yapiyor.
                        'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-navy-50 font-semibold text-navy-900'
                          : 'font-medium text-ink-700 hover:bg-ink-100 hover:text-navy-900',
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r bg-gold-500"
                        />
                      )}
                      <Icon
                        size={16}
                        className={cn(
                          'shrink-0 transition-colors',
                          active ? 'text-navy-700' : 'text-ink-400 group-hover:text-ink-600',
                        )}
                      />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-ink-200 p-3">
          <div className="flex items-center gap-2.5 px-3 pb-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-900 text-[0.6875rem] font-semibold text-white">
              {initials(me.data?.fullName)}
            </span>
            <p className="truncate text-xs font-medium text-ink-700">{me.data?.fullName ?? '—'}</p>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-debit-soft hover:text-debit"
          >
            <LogOut size={16} className="shrink-0" />
            {tr.nav.logout}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}

/** "Ahmet Yilmaz" → "AY". Bos veya tek kelimede de patlamaz. */
function initials(name?: string): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toLocaleUpperCase('tr-TR');
}
