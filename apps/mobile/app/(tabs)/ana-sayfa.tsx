import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, router } from 'expo-router';
import { Megaphone, MessageSquare } from 'lucide-react-native';
import { PieChart } from 'react-native-gifted-charts';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type AuthenticatedUser, type MembershipSummary, type MoneyString } from '@carinet/shared';
import { AppHeader } from '@/components/app-header';
import { apiGet } from '@/lib/api';
import { registerForPush } from '@/lib/push';
import { balanceColor, limitUsage, money, trDate } from '@/lib/format';
import { color, numeric, radius, shadow, space } from '@/lib/theme';
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

interface RiskSummary {
  overdue: MoneyString;
  notDue: MoneyString;
  buckets: Record<'NOT_DUE' | 'D0_30' | 'D31_60' | 'D61_90' | 'D90_PLUS', MoneyString>;
  averageDueDate: string | null;
  averageOverdueDays: number;
  limitUsagePercent: number | null;
}

/** §13 Faz 1 — Dashboard: cari kodu, bakiye, limit, temsilci, borc/alacak pastasi, son 10 hareket. */
export default function HomeScreen() {
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

  /** Risk foyu (§13 Faz 2): vadesi gecen tutar + ortalama vade — alici da gorur. */
  const risk = useQuery({
    queryKey: ['risk', dashboard.data?.account.id],
    queryFn: () => apiGet<RiskSummary>(`/reports/risk/${dashboard.data!.account.id}`),
    enabled: Boolean(dashboard.data?.account.id),
    retry: false,
  });

  // Push izni + token kaydi. Reddedilirse sessizce gecer; bildirim merkezi yine calisir.
  useEffect(() => {
    void registerForPush();
  }, []);

  if (me.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={color.navy[600]} />
      </SafeAreaView>
    );
  }

  // Oturum cozulemiyorsa girise don — cikis akisi artik /profil'de.
  if (me.isError || !me.data) {
    return (
      <SafeAreaView style={styles.center}>
        <Pressable onPress={() => router.replace('/giris')}>
          <Text style={styles.link}>{tr.login.submit}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = dashboard.data;
  const debit = data ? Number(data.balance.totalDebit) : 0;
  const credit = data ? Number(data.balance.totalCredit) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Baslik: logo + rozetli zil + profil. Zil ve rozet artik AppHeader'in isi (tek kaynak). */}
      <AppHeader
        right={
          <Pressable
            onPress={() => router.push('/profil')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={tr.header.profile}
            style={styles.avatarBtn}
          >
            <Text style={styles.avatarText}>{initials(me.data.fullName)}</Text>
          </Pressable>
        }
      />

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
              <Stat
                label={tr.home.debt}
                value={money(data.balance.totalDebit)}
                color={color.debit}
              />
              <Stat
                label={tr.home.credit}
                value={money(data.balance.totalCredit)}
                color={color.credit}
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
                    { value: debit, color: color.debit, text: tr.home.debt },
                    { value: credit, color: color.credit, text: tr.home.credit },
                  ]}
                  donut
                  radius={70}
                  innerRadius={45}
                  centerLabelComponent={() => (
                    <Text style={styles.chartCenter}>{tr.home.balance}</Text>
                  )}
                />
                <View style={styles.legend}>
                  <Legend color={color.debit} label={tr.home.debt} />
                  <Legend color={color.credit} label={tr.home.credit} />
                </View>
              </View>
            ) : null}

            {risk.data && Number(risk.data.overdue) > 0 ? (
              <View style={styles.riskCard}>
                <Text style={styles.cardLabel}>{tr.home.overdue}</Text>
                <Text style={styles.riskAmount}>{money(risk.data.overdue)}</Text>
                <View style={styles.riskRow}>
                  <RiskBucket label="0-30" value={risk.data.buckets.D0_30} />
                  <RiskBucket label="31-60" value={risk.data.buckets.D31_60} />
                  <RiskBucket label="61-90" value={risk.data.buckets.D61_90} />
                  <RiskBucket label="90+" value={risk.data.buckets.D90_PLUS} />
                </View>
                {risk.data.averageDueDate ? (
                  <Text style={styles.cardHint}>
                    {tr.home.averageDue}: {trDate(risk.data.averageDueDate)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* §8 — iki kanalli tahsilat: havale referansi veya saticinin hosted 3D POS sayfasi. */}
            <Pressable style={styles.payButton} onPress={() => router.push('/odeme')}>
              <Text style={styles.payButtonText}>{tr.pay.cta}</Text>
            </Pressable>

            {/* §13 Faz 4. Vitrin BURADA YOK — artik alt sekme; iki yerde durmasi mukerrer olurdu. */}
            <View style={styles.quickRow}>
              <Pressable style={styles.quickTile} onPress={() => router.push('/kampanyalar')}>
                <Megaphone size={18} color={color.navy[700]} />
                <Text style={styles.quickText}>{tr.campaigns.title}</Text>
              </Pressable>
              <Pressable style={styles.quickTile} onPress={() => router.push('/talepler')}>
                <MessageSquare size={18} color={color.navy[700]} />
                <Text style={styles.quickText}>{tr.requests.title}</Text>
              </Pressable>
            </View>

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
                      { color: t.type === 'DEBIT' ? color.debit : color.credit },
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

        {/* Hesap degistirici, yasal baglantilar ve cikis → /profil (basliktaki avatar).
            Ana sayfa yalnizca "bakiyeni 3 saniyede gor" isine odaklanir; bunlar seyrek islerdir. */}
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

function RiskBucket({ label, value }: { label: string; value: MoneyString }) {
  const empty = Number(value) === 0;
  return (
    <View style={styles.bucket}>
      <Text style={styles.bucketLabel}>{label}</Text>
      <Text style={[styles.bucketValue, empty && styles.bucketEmpty]}>
        {empty ? '—' : money(value)}
      </Text>
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

/** "Ahmet Yilmaz" → "AY" */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const a = parts[0]![0] ?? '';
  const b = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (a + b).toLocaleUpperCase('tr-TR');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ink[100],
  },
  container: { padding: space.lg, paddingBottom: space.xxl + space.lg },
  greeting: { fontSize: 15, color: color.ink[600], marginBottom: space.md },
  link: { color: color.navy[700], fontWeight: '600', fontSize: 13 },

  // Basliktaki profil dugmesi (avatar). Zil AppHeader'in kendi isi.
  avatarBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: color.navy[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: color.white, fontSize: 11, fontWeight: '700' },

  // Bakiye karti — ekranin kahramani (kuzey yildizi: 3 saniyede gor).
  card: {
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.ink[200],
    ...shadow.card,
  },
  cardLabel: {
    color: color.ink[500],
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balance: { fontSize: 32, fontWeight: '800', marginTop: space.xs, letterSpacing: -0.5 },
  cardMeta: { color: color.ink[600], fontSize: 13, marginTop: 2 },
  cardHint: { color: color.ink[500], fontSize: 12, marginTop: space.sm },

  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  stat: {
    flex: 1,
    backgroundColor: color.white,
    borderRadius: radius.sm,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.ink[200],
  },
  statLabel: { fontSize: 11, color: color.ink[500], textTransform: 'uppercase', fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '700', color: color.navy[900], marginTop: 2 },

  chartCard: {
    marginTop: space.md,
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.ink[200],
    alignItems: 'center',
  },
  chartCenter: { fontSize: 11, color: color.ink[600] },
  legend: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // Vadesi gecen borc: soluk kirmizi zemin + serit. Kirmizi CERCEVE degil — kart "hata" gibi durmasin.
  riskCard: {
    marginTop: space.md,
    backgroundColor: color.debitSoft,
    borderRadius: radius.md,
    padding: space.lg,
    borderLeftWidth: 3,
    borderLeftColor: color.debit,
  },
  riskAmount: { fontSize: 22, fontWeight: '800', color: color.debit, marginTop: space.xs },
  riskRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  bucket: { alignItems: 'center', flex: 1 },
  bucketLabel: { fontSize: 11, color: color.ink[600] },
  bucketValue: { fontSize: 12, fontWeight: '700', color: color.navy[900], marginTop: 2 },
  bucketEmpty: { color: color.ink[400], fontWeight: '400' },

  quickRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  quickTile: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: color.white,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.ink[200],
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: { fontSize: 13, fontWeight: '600', color: color.navy[900] },

  payButton: {
    marginTop: space.md,
    backgroundColor: color.navy[900],
    borderRadius: radius.md,
    paddingVertical: space.lg - 2,
    alignItems: 'center',
    ...shadow.card,
  },
  payButtonText: { color: color.white, fontWeight: '700', fontSize: 15 },

  repCard: {
    marginTop: space.md,
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.ink[200],
  },
  repName: { fontSize: 15, fontWeight: '700', color: color.navy[900], marginTop: space.xs },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: color.navy[900] },
  hint: { fontSize: 13, color: color.ink[600], marginBottom: space.md, marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.ink[200],
    borderRadius: radius.sm,
    padding: space.md + 2,
    marginBottom: space.sm,
  },
  rowLeft: { flex: 1, paddingRight: space.md },
  rowTitle: { fontSize: 14, fontWeight: '600', color: color.navy[900] },
  rowMeta: { fontSize: 12, color: color.ink[600], marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '700', ...numeric },
});
