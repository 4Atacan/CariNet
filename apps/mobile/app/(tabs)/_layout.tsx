import { Tabs } from 'expo-router';
import { Home, ReceiptText, Store, Wallet } from 'lucide-react-native';
import { Platform } from 'react-native';
import { color, space } from '@/lib/theme';
import { tr } from '@/lib/tr';

/**
 * Alt sekmeler — alicinin GUNLUK 4 isi. Kuzey yildizi "bakiyeni 3 saniyede gor" oldugu icin
 * Ana Sayfa ilk sekme; Ekstre ve Odeme tek dokunus uzakta.
 *
 * Bildirim SEKMEDE DEGIL, baslikta zil olarak durur (bkz. app-header.tsx) — bildirim bir "is"
 * degil uyaridir. Kampanyalar/Talepler/Gizlilik gibi seyrek ekranlar sekmeye girmez; ana sayfadan
 * ve baslikdan acilir.
 *
 * Ekranlar `(tabs)` GRUBUNDA: parantezli klasor URL'e girmez, yani /ana-sayfa gibi mevcut rotalar
 * ve onlara yapilan router.push cagrilari aynen calisir.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Baslik ekranlarin kendi <AppHeader />'i (logo + zil + profil).
        tabBarActiveTintColor: color.navy[900],
        tabBarInactiveTintColor: color.ink[500],
        tabBarStyle: {
          backgroundColor: color.white,
          borderTopColor: color.ink[200],
          // Android'de varsayilan yukseklik metni sikistiriyor.
          height: Platform.select({ ios: 84, default: 62 }),
          paddingTop: space.xs,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingVertical: space.xs / 2 },
      }}
    >
      <Tabs.Screen
        name="ana-sayfa"
        options={{
          title: tr.tabs.home,
          tabBarIcon: ({ color: c, size }) => <Home size={size - 2} color={c} />,
        }}
      />
      <Tabs.Screen
        name="ekstre"
        options={{
          title: tr.tabs.statement,
          tabBarIcon: ({ color: c, size }) => <ReceiptText size={size - 2} color={c} />,
        }}
      />
      <Tabs.Screen
        name="odeme"
        options={{
          title: tr.tabs.pay,
          tabBarIcon: ({ color: c, size }) => <Wallet size={size - 2} color={c} />,
        }}
      />
      <Tabs.Screen
        name="vitrin"
        options={{
          title: tr.tabs.catalog,
          tabBarIcon: ({ color: c, size }) => <Store size={size - 2} color={c} />,
        }}
      />
    </Tabs>
  );
}
