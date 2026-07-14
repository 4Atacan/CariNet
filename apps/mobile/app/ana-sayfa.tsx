import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { PieChart } from 'react-native-gifted-charts';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type AuthenticatedUser,
  type LoginResponse,
  type MembershipSummary,
  type MoneyString,
} from '@carinet/shared';
import { apiGet, apiPost, tokenStore } from '@/lib/api';
import { balanceColor, limitUsage, money, trDate } from '@/lib/format';
import { useSession } from '@/store/session';
import { tr } from '@/lib/tr';

interface MeResponse extends AuthenticatedUser {
  memberships: MembershipSummary[];
}

interface Dashboard {
  account: {
    id: string;
    accountCode: string;
    title: string;
    creditLimit: MoneyString;
    representative: { fullName: string; phone: string | null } | null;
  };
  balance: {
    balance: MoneyString;
    totalDebit: MoneyString;
    totalCredit: MoneyString;
  };
  recentTransactions: {
    id: string;
    type: 'DEBIT' | 'CREDIT';
    documentType: string;
    documentNo: string | null;
    documentDate: string;
    amount: MoneyString;
    currencyCode: string;
    description: string | null;
  }[];
}

/** §13 Faz 1 — Dashboard: cari kodu, bakiye, limit, temsilci, borc/alacak pastasi, son 10 hareket. */
export default function HomeScreen() {
  const queryClient = useQueryClient();
  const clearSession = useSession((s) => s.clear);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<MeResponse>('/auth/me'),
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<Dashboard>('/buyers/me'),
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
  const data = dashboard.data;
  const debit = data ? Number(data.balance.totalDebit) : 0;
  const credit = data ? Number(data.balance.totalCredit) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>
          {tr.home.greeting}, {me.data.fullName}
        </Text>

        {data ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{tr.home.balance}</Text>
              <Text style={[styles.balance, { color: balanceColor(data.balance.balance) }]}>
                {money(data.balance.balance)}
              </Text>
              <Text style={styles.cardMeta}>
                {data.account.accountCode} · {data.account.title}
              </Text>
              <Text style={styles.cardHint}>{tr.home.balanceHint}</Text>
            </View>

            <View style={styles.statRow}>
              <Stat label={tr.home.debt} value={money(data.balance.totalDebit)} color="#dc2626" />
              <Stat
                label={tr.home.credit}
                value={money(data.balance.totalCredit)}
                color="#059669"
              />
            </View>

            <View style={styles.statRow}>
              <Stat label={tr.home.creditLimit} value={money(data.account.creditLimit)} />
              <Stat
                label={tr.home.limitUsage}
                value={`%${limitUsage(data.balance.balance, data.account.creditLimit)}`}
              />
            </View>

            {debit + credit > 0 ? (
              <View style={styles.chartCard}>
                <PieChart
                  data={[
                    { value: debit, color: '#dc2626', text: tr.home.debt },
                    { value: credit, color: '#059669', text: tr.home.credit },
                  ]}
                  donut
                  radius={70}
                  innerRadius={45}
                  centerLabelComponent={() => (
                    <Text style={styles.chartCenter}>{tr.home.balance}</Text>
                  )}
                />
                <View style={styles.legend}>
                  <Legend color="#dc2626" label={tr.home.debt} />
                  <Legend color="#059669" label={tr.home.credit} />
                </View>
              </View>
            ) : null}

            {data.account.representative ? (
              <View style={styles.repCard}>
                <Text style={styles.cardLabel}>{tr.home.representative}</Text>
                <Text style={styles.repName}>{data.account.representative.fullName}</Text>
                {data.account.representative.phone ? (
                  <Text style={styles.cardMeta}>{data.account.representative.phone}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{tr.home.recent}</Text>
              <Link href="/ekstre" style={styles.link}>
                {tr.home.statement}
              </Link>
            </View>

            {data.recentTransactions.length === 0 ? (
              <Text style={styles.hint}>{tr.home.empty}</Text>
            ) : (
              data.recentTransactions.map((t) => (
                <View key={t.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>{t.description ?? t.documentType}</Text>
                    <Text style={styles.rowMeta}>
                      {trDate(t.documentDate)}
                      {t.documentNo ? ` · ${t.documentNo}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.rowAmount,
                      { color: t.type === 'DEBIT' ? '#dc2626' : '#059669' },
                    ]}
                  >
                    {t.type === 'DEBIT' ? '+' : '−'}
                    {money(t.amount, t.currencyCode)}
                  </Text>
                </View>
              ))
            )}
          </>
        ) : dashboard.isLoading ? (
          <ActivityIndicator />
        ) : null}

        <Text style={[styles.sectionTitle, styles.switcherTitle]}>{tr.switcher.title}</Text>
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

        {active ? null : null}

        <Pressable style={styles.logout} onPress={() => logout.mutate()}>
          <Text style={styles.logoutText}>{tr.home.logout}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.rowMeta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  container: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  balance: { fontSize: 30, fontWeight: '700', marginTop: 4 },
  cardMeta: { color: '#64748b', fontSize: 13, marginTop: 2 },
  cardHint: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 2 },
  chartCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  chartCenter: { fontSize: 11, color: '#64748b' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  repCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  repName: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  switcherTitle: { marginTop: 28 },
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
  rowLeft: { flex: 1, paddingRight: 12 },
  rowActive: { borderColor: '#0f172a' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  rowMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '600' },
  badge: { color: '#16a34a', fontSize: 16 },
  logout: { marginTop: 24, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
  link: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
});
