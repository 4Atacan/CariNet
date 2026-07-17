/**
 * CariNet mobil tasarim belirtecleri — kaynak: logo (carinet_logo.PNG).
 *   lacivert #152A55 · altin #D5A215 · gri #8A949E
 *
 * Asagidaki degerler panelin `globals.css`'indeki OKLCH olceginden HESAPLANARAK uretildi (elle
 * yazilmadi) → iki uygulama birebir ayni paleti kullanir. Panelde bir ton degisirse burasi da
 * yeniden uretilmelidir; "yaklasik ayni" tutulan iki palet zamanla ayrisir.
 *
 * Onceki hal: #0f172a / #64748b gibi Tailwind slate degerleri 12 ekrana dagilmisti ve tema dosyasi
 * yoktu. Varsayilan slate her uygulamada ayni gorunur — markayi silen seydi.
 */
export const color = {
  /** Lacivert — marka. 900 = logonun tam rengi. */
  navy: {
    50: '#F1F6FE',
    100: '#E3ECFA',
    200: '#CCDAF3',
    300: '#ACC0E6',
    400: '#849FD1',
    500: '#5E7DB8',
    600: '#405F9C',
    700: '#2A457C',
    800: '#1E3666',
    900: '#152A55',
    950: '#0A1B3D',
  },
  /** Altin — vurgu. 500 = logonun tam rengi. */
  gold: {
    50: '#FCF6EB',
    100: '#F9EDD5',
    200: '#F4DDAF',
    300: '#EECD87',
    400: '#E2B756',
    500: '#D5A214',
    600: '#C09000',
    700: '#9F7600',
    800: '#7E5D00',
    900: '#634800',
  },
  /** Ink — notr. 500 = logonun grisi. Lacivert tonlu (H=248), jenerik gri DEGIL. */
  ink: {
    50: '#F8FAFC',
    100: '#F1F4F7',
    200: '#E2E7EB',
    300: '#CFD5DB',
    400: '#AAB2BA',
    500: '#8A949E',
    600: '#6B7681',
    700: '#4E5965',
    800: '#36414C',
    900: '#222D37',
  },
  /**
   * Finansal anlam. ALTIN BURAYA GIRMEZ — altin yalniz marka vurgusudur (aktif sekme, logo).
   * Altin hem "marka" hem "uyari" demek olsaydi kullanici ikisini ayirt edemezdi.
   * Aciklik degerleri beyaz zeminde WCAG AA (>=4.5) olculerek secildi (debit 5.34 · credit 4.56 ·
   * warn 4.57): para metni govde metnidir, "yesil ama okunmuyor" kabul edilemez.
   */
  debit: '#C9302D',
  debitSoft: '#FFEAE7',
  credit: '#14874E',
  creditSoft: '#E1F7E7',
  warn: '#C4530F',
  warnSoft: '#FFEADC',

  white: '#FFFFFF',
} as const;

/** 4'un katlari — dikey ritim tutarli olsun. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Para/tarih: rakamlar esit genislikte hizalanmali (kural #1'in gorsel karsiligi). */
export const numeric = { fontVariant: ['tabular-nums' as const] };

/** iOS golge + Android elevation ayri API'ler; ikisini birlikte veriyoruz. */
export const shadow = {
  card: {
    shadowColor: color.navy[900],
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
