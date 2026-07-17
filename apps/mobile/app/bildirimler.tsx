import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGetPaged, apiPost } from '@/lib/api';
import { trDate } from '@/lib/format';
import { tr } from '@/lib/tr';
import { color } from '@/lib/theme';
import { AppHeader } from '@/components/app-header';

type NotificationType = keyof typeof tr.notifications.types;

interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
}

/**
 * §13 Faz 4 — bildirim merkezi. Liste AKTIF HESABIN bildirimlerini gosterir (§6.2):
 * kullanici baska bir cariye gecerse o hesabin bildirimlerini gorur.
 */
export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGetPaged<Notification>('/notifications?limit=50'),
  });

  const markAll = useMutation({
    mutationFn: () => apiPost('/notifications/read', { all: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['unread'] });
    },
  });

  const rows = notifications.data?.data ?? [];
  const hasUnread = rows.some((n) => !n.readAt);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <AppHeader
        title={tr.notifications.title}
        back
        right={
          hasUnread ? (
            <Pressable onPress={() => markAll.mutate()} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>{tr.notifications.markAll}</Text>
            </Pressable>
          ) : null
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{tr.notifications.empty}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.readAt && styles.unread]}>
            <View style={styles.cardHead}>
              <Text style={styles.badge}>{tr.notifications.types[item.type]}</Text>
              <Text style={styles.date}>{trDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: color.ink[600], fontSize: 14 },
  title: { fontSize: 22, fontWeight: '600', color: color.navy[900] },
  link: { color: color.navy[900], fontSize: 13, textDecorationLine: 'underline' },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: color.white, borderRadius: 12, padding: 14, gap: 4 },
  unread: { borderLeftWidth: 3, borderLeftColor: color.navy[900] },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  badge: { fontSize: 11, fontWeight: '600', color: color.ink[600], textTransform: 'uppercase' },
  date: { fontSize: 11, color: color.ink[400] },
  cardTitle: { fontSize: 15, fontWeight: '600', color: color.navy[900] },
  cardBody: { fontSize: 14, color: color.ink[700], lineHeight: 19 },
  empty: { textAlign: 'center', color: color.ink[400], marginTop: 40 },
});
