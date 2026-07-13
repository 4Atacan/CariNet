/** §12 — UI metinleri sozlukte tutulur; bilesenlere sabit metin gomulmez. */
export const tr = {
  app: {
    name: 'CariNet',
    tagline: 'B2B cari hesap platformu',
  },
  login: {
    title: 'Satici Paneli Girisi',
    email: 'E-posta',
    password: 'Sifre',
    totp: 'Dogrulama kodu (2FA)',
    submit: 'Giris yap',
    submitting: 'Giris yapiliyor...',
    forgot: 'Sifremi unuttum',
    genericError: 'Giris yapilamadi. Lutfen bilgilerinizi kontrol edin.',
  },
  dashboard: {
    title: 'Panel',
    welcome: 'Hos geldiniz',
    activeContext: 'Aktif hesap',
    memberships: 'Uyelikleriniz',
    buyerAccounts: 'Cari hesaplar',
    logout: 'Cikis yap',
    empty: 'Kayit bulunamadi.',
  },
  common: {
    loading: 'Yukleniyor...',
    error: 'Bir hata olustu.',
    accountCode: 'Cari kodu',
    title: 'Unvan',
    creditLimit: 'Kredi limiti',
    representative: 'Temsilci',
  },
} as const;
