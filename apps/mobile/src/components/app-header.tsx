import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import logo from '../../assets/logo.png';
import { apiGet } from '@/lib/api';
import { color, radius, space } from '@/lib/theme';
import { tr } from '@/lib/tr';

/**
 * Tum ekranlarin ortak basligi.
 *
 * Bildirim ZILDE durur, alt sekmede degil: sekme cubugu gunluk 4 isi tasir (bakiye/ekstre/odeme/
 * vitrin); bildirim bir "is" degil, bir uyaridir — rozetiyle birlikte baslikta durmasi hem
 * platform aliskanligi hem de sekme cubugunu bosaltir.
 */
export function AppHeader({
  title,
  back = false,
  right,
}: {
  /** Verilmezse logo gosterilir (sekme ekranlari). Verilirse baslik metni (ic ekranlar). */
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  // Rozet: sekme ekranlarinda da ic ekranlarda da ayni sayaci gosterir (tek kaynak).
  const unread = useQuery({
    queryKey: ['unread'],
    queryFn: () => apiGet<{ unread: number }>('/notifications/unread-count'),
    staleTime: 30_000,
  });
  const count = unread.data?.unread ?? 0;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {back ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={tr.common.back}
              style={styles.backBtn}
            >
              <ChevronLeft size={22} color={color.navy[900]} />
            </Pressable>
          ) : null}

          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <Image
              source={logo}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel={tr.app.name}
            />
          )}
        </View>

        <View style={styles.right}>
          {right}
          <Pressable
            onPress={() => router.push('/bildirimler')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              count > 0 ? `${tr.header.notifications} (${count})` : tr.header.notifications
            }
            style={styles.iconBtn}
          >
            <Bell size={20} color={color.ink[700]} />
            {count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {count > 99 ? '99+' : count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: color.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.ink[200],
    paddingBottom: space.md,
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  backBtn: { marginLeft: -space.sm, padding: space.xs },
  logo: { width: 104, height: 26 },
  title: { fontSize: 17, fontWeight: '700', color: color.navy[900], flexShrink: 1 },
  iconBtn: { padding: space.sm, borderRadius: radius.pill },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: color.debit,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.white,
  },
  badgeText: { color: color.white, fontSize: 10, fontWeight: '700' },
});
