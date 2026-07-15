import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tr } from '@/lib/tr';

/**
 * §11.6 (KVKK) — Aydinlatma metni + gizlilik politikasi. Magaza incelemesi bunu gorunur ister.
 * Metin sablondur; veri sorumlusu (satici/platform) tuzel kisi bilgileriyle netlestirilir.
 */
export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{tr.common.back}</Text>
        </Pressable>
        <Text style={styles.title}>{tr.legal.title}</Text>

        {SECTIONS.map((s) => (
          <View key={s.h} style={styles.block}>
            <Text style={styles.h}>{s.h}</Text>
            <Text style={styles.p}>{s.p}</Text>
          </View>
        ))}

        <Text style={styles.updated}>Son guncelleme: 15.07.2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** KVKK 10. madde aydinlatma yapisi. Satici firma kendi tuzel kisi bilgileriyle tamamlar. */
const SECTIONS = [
  {
    h: 'Veri Sorumlusu',
    p: 'CariNet uygulamasi uzerinden cari hesap iliskiniz bulunan satici firma, kisisel verilerinizin veri sorumlusudur. Iletisim ve basvuru bilgileri ilgili satici firma tarafindan saglanir.',
  },
  {
    h: 'Islenen Veriler',
    p: 'Ad-soyad, e-posta, telefon; cari hesap kodu, bakiye, fatura ve hareket kayitlari; oturum ve cihaz bilgileri (guvenlik amaciyla). Kart bilgisi UYGULAMAYA GIRILMEZ; kartli odemeler saticinin bankasi/PSP hosted sayfasinda yapilir.',
  },
  {
    h: 'Isleme Amaclari',
    p: 'Cari hesabinizin goruntulenmesi, tahsilat ve ekstre hizmetleri, bildirim gonderimi, guvenlik ve dolandiriciligin onlenmesi, yasal yukumluluklerin yerine getirilmesi (fatura/defter saklama).',
  },
  {
    h: 'Saklama Suresi',
    p: 'Finansal kayitlar ilgili mevzuattaki (ornegin Vergi Usul Kanunu) saklama sureleri boyunca tutulur. Hesabinizi sildiginizde kimlik bilgileriniz anonimlestirilir; finansal kayitlar kimliginizle iliskilendirilmeden defterlerde kalir.',
  },
  {
    h: 'Guvenlik',
    p: 'Veriler sifreli baglanti (TLS) uzerinden tasinir; parolalar geri donusturulemez sekilde saklanir; hassas anahtarlar sifrelenir. Yonetici hesaplarinda iki adimli dogrulama (2FA) zorunludur.',
  },
  {
    h: 'Haklariniz (KVKK m.11)',
    p: 'Verilerinize erisim, duzeltme, silme/anonimlestirme ve isleme itiraz haklariniz vardir. Hesabinizi uygulama icinden "Hesabimi sil" ile silebilir; diger talepleriniz icin satici firmaya veya Talep-Oneri ekranindan basvurabilirsiniz.',
  },
] as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  back: { color: '#64748b', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  block: { gap: 4 },
  h: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  p: { fontSize: 14, color: '#475569', lineHeight: 20 },
  updated: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
});
