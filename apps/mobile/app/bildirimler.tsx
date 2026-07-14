import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGetPaged, apiPost } from '@/lib/api';
import { trDate } from '@/lib/format';
import { tr } from '@/lib/tr';

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{tr.common.back}</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{tr.notifications.title}</Text>
          {hasUnread ? (
            <Pressable onPress={() => markAll.mutate()}>
              <Text style={styles.link}>{tr.notifications.markAll}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

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
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: '#64748b', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  link: { color: '#0f172a', fontSize: 13, textDecorationLine: 'underline' },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 4 },
  unread: { borderLeftWidth: 3, borderLeftColor: '#0f172a' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  badge: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  date: { fontSize: 11, color: '#94a3b8' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cardBody: { fontSize: 14, color: '#475569', lineHeight: 19 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
