import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { tr } from '@/lib/tr';
import { QueryProvider } from '@/components/query-provider';
import './globals.css';

/**
 * Logonun yazisi geometrik-humanist; Plus Jakarta Sans ona yakin durur ve tabular rakamlari var
 * (para kolonlari hizali okunmali, globals.css). OFL lisansli, ucretsiz (kural #8).
 *
 * `next/font` fontu DERLEME aninda indirip KENDI sunar → calisma aninda Google'a istek gitmez.
 * Bu §11.2'nin siki CSP'si icin onemli: harici font kaynagi acmak zorunda kalmayiz.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin-ext'], // Turkce: ı ğ ş İ Ğ Ş
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: `${tr.app.name} — ${tr.app.tagline}`,
  description: tr.app.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={jakarta.variable}>
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
