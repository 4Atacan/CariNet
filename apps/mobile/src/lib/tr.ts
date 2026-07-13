/** §12 — UI metinleri sozlukte. */
export const tr = {
  app: { name: 'CariNet' },
  login: {
    title: 'Giris Yap',
    subtitle: 'Cari hesabinizi goruntuleyin',
    email: 'E-posta',
    password: 'Sifre',
    remember: 'Beni hatirla',
    submit: 'Giris yap',
    submitting: 'Giris yapiliyor...',
    error: 'Giris yapilamadi.',
  },
  home: {
    greeting: 'Merhaba',
    activeAccount: 'Aktif hesap',
    switchAccount: 'Hesap degistir',
    logout: 'Cikis yap',
    accountCode: 'Cari kodu',
  },
  switcher: {
    title: 'Hesaplarim',
    hint: 'Goruntulemek istediginiz cari hesabi secin.',
  },
  common: { loading: 'Yukleniyor...' },
} as const;
