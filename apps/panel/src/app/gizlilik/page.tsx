import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gizlilik ve KVKK · CariNet',
  description: 'CariNet gizlilik politikasi ve KVKK aydinlatma metni.',
};

/**
 * §11.6 (KVKK) — Herkese acik aydinlatma metni. Magaza ve KVKK icin gorunur bir URL gerekir.
 * Metin sablondur; veri sorumlusu (satici/platform) tuzel kisi bilgileriyle netlestirilir.
 */
const SECTIONS = [
  {
    h: 'Veri Sorumlusu',
    p: 'CariNet uzerinden cari hesap iliskiniz bulunan satici firma, kisisel verilerinizin veri sorumlusudur. Iletisim ve basvuru bilgileri ilgili satici firma tarafindan saglanir.',
  },
  {
    h: 'Islenen Kisisel Veriler',
    p: 'Ad-soyad, e-posta, telefon; cari hesap kodu, bakiye, fatura ve hareket kayitlari; oturum ve cihaz bilgileri (guvenlik amaciyla). Kart bilgisi platforma GIRILMEZ ve platform hesabinda para toplanmaz; kartli odemeler saticinin bankasi/PSP hosted 3D sayfasinda yapilir.',
  },
  {
    h: 'Isleme Amaclari ve Hukuki Sebep',
    p: 'Cari hesabin goruntulenmesi, tahsilat/ekstre hizmetleri, bildirim gonderimi, guvenlik ve dolandiriciligin onlenmesi, yasal yukumluluklerin (fatura/defter saklama) yerine getirilmesi. Islemeler sozlesmenin ifasi, hukuki yukumluluk ve mesru menfaat sebeplerine dayanir.',
  },
  {
    h: 'Saklama Suresi',
    p: 'Finansal kayitlar ilgili mevzuattaki (or. Vergi Usul Kanunu, Turk Ticaret Kanunu) saklama sureleri boyunca tutulur. Hesap silindiginde kimlik bilgileri anonimlestirilir; finansal kayitlar kimlikle iliskilendirilmeden defterlerde kalir.',
  },
  {
    h: 'Aktarim',
    p: 'Veriler; barindirma (VPS), bildirim (push) ve e-posta gonderimi gibi hizmet saglayicilarla, yalnizca hizmetin gerektirdigi olcude ve sozlesmesel gizlilik yukumlulukleri altinda paylasilir. Veriler pazarlama amaciyla ucuncu taraflara satilmaz.',
  },
  {
    h: 'Guvenlik',
    p: 'Veriler sifreli baglanti (TLS) uzerinden tasinir; parolalar geri donusturulemez sekilde (argon2id) saklanir; hassas anahtarlar sifrelenir (AES-256-GCM). Yonetici hesaplarinda iki adimli dogrulama (2FA) zorunludur; sizmis parolalar engellenir.',
  },
  {
    h: 'Ilgili Kisi Haklari (KVKK m.11)',
    p: 'Verilerinize erisim, duzeltme, silme/anonimlestirme ve isleme itiraz haklariniz vardir. Hesabinizi mobil uygulamadan "Hesabimi sil" ile silebilir; diger talepleriniz icin satici firmaya veya Talep-Oneri kanalina basvurabilirsiniz.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Gizlilik ve KVKK Aydinlatma Metni</h1>
      <p className="mt-2 text-sm text-slate-500">Son guncelleme: 15.07.2026</p>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="text-base font-semibold text-slate-900">{s.h}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.p}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-slate-400">
        Bu metin genel bir sablondur ve hukuki danismanlik yerine gecmez. Satici firma, kendi tuzel
        kisi bilgileri ve surecleriyle metni netlestirmelidir.
      </p>
    </main>
  );
}
