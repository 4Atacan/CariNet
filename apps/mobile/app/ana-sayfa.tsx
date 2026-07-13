import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type AuthenticatedUser,
  type LoginResponse,
  type MembershipSummary,
} from '@carinet/shared';
import { apiGet, apiPost, tokenStore } from '@/lib/api';
import { useSession } from '@/store/session';
import { tr } from '@/lib/tr';

interface MeResponse extends AuthenticatedUser {
  memberships: MembershipSummary[];
}

/** Faz 0: kimlik + hesap degistirici calisiyor. Dashboard verileri Faz 1'de. */
export default function HomeScreen() {
  const queryClient = useQueryClient();
  const clearSession = useSession((s) => s.clear);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<MeResponse>('/auth/me'),
    retry: false,
  });

  const switchAccount = useMutation({
    mutationFn: (membershipId: string) =>
      apiPost<LoginResponse>('/auth/switch-account', { membershipId }),
    onSuccess: async (result) => {
      await tokenStore.save(result.tokens); // yeni baglam → yeni token cifti (§6.2)
      await queryClient.invalidateQueries();
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      const refreshToken = await tokenStore.getRefresh();
      await apiPost<{ ok: true }>('/auth/logout', { refreshToken });
    },
    onSettled: async () => {
      await clearSession();
      queryClient.clear();
      router.replace('/giris');
    },
  });

  if (me.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (me.isError || !me.data) {
    return (
      <SafeAreaView style={styles.center}>
        <Pressable onPress={() => logout.mutate()}>
          <Text style={styles.link}>{tr.home.logout}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const active = me.data.memberships.find((m) => m.membershipId === me.data.membershipId);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>
          {tr.home.greeting}, {me.data.fullName}
        </Text>

        {active ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{tr.home.activeAccount}</Text>
            <Text style={styles.cardTitle}>{active.sellerName}</Text>
            {active.accountCode ? (
              <Text style={styles.cardMeta}>
                {tr.home.accountCode}: {active.accountCode}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{tr.switcher.title}</Text>
        <Text style={styles.hint}>{tr.switcher.hint}</Text>

        {me.data.memberships.map((m) => {
          const isActive = m.membershipId === me.data.membershipId;
          return (
            <Pressable
              key={m.membershipId}
              style={[styles.row, isActive && styles.rowActive]}
              disabled={isActive || switchAccount.isPending}
              onPress={() => switchAccount.mutate(m.membershipId)}
            >
              <View>
                <Text style={styles.rowTitle}>{m.sellerName}</Text>
                <Text style={styles.rowMeta}>
                  {m.accountTitle ?? m.role}
                  {m.accountCode ? ` · ${m.accountCode}` : ''}
                </Text>
              </View>
              {isActive ? <Text style={styles.badge}>●</Text> : null}
            </Pressable>
          );
        })}

        <Pressable style={styles.logout} onPress={() => logout.mutate()}>
          <Text style={styles.logoutText}>{tr.home.logout}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  container: { padding: 20 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cardLabel: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 4 },
  cardMeta: { color: '#cbd5e1', fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  hint: { fontSize: 13, color: '#64748b', marginBottom: 12, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowActive: { borderColor: '#0f172a' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  rowMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badge: { color: '#16a34a', fontSize: 16 },
  logout: { marginTop: 24, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
  link: { color: '#0f172a', fontSize: 14 },
});
