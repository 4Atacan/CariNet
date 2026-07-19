import type { Metadata } from 'next';
import { tr } from '@/lib/tr';
import { QueryProvider } from '@/components/query-provider';
import './globals.css';

/**
 * Logonun yazisi geometrik-humanist; Plus Jakarta Sans ona yakin durur ve tabular rakamlari var
 * (para kolonlari hizali okunmali, globals.css). OFL lisansli, ucretsiz (kural #8).
 *
 * Font dosyalari DEPODA (`public/fonts`) ve @font-face globals.css'te tanimli.
 * Onceki hali `next/font/google` idi: o da self-host ediyor ama fontu DERLEME ANINDA
 * Google'dan indiriyor. CI'da bu indirme iki kez asildi ve panel derlemesi 30 dakikalik
 * zaman asimina dustu — sifir cikti veren, yeri belirsiz bir bekleme. Dosyalar depoda
 * oldugundan derleme artik dis aga hic cikmaz. Calisma aninda da istek gitmez, §11.2'nin
 * siki CSP'si icin harici font kaynagi acmaya gerek kalmaz.
 */

export const metadata: Metadata = {
  title: `${tr.app.name} — ${tr.app.tagline}`,
  description: tr.app.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
