import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MoneyString } from '@carinet/shared';
import { apiGetPaged } from '@/lib/api';
import { balanceColor, money, trDate } from '@/lib/format';
import { shareStatementPdf } from '@/lib/pdf';
import { tr } from '@/lib/tr';

interface StatementLine {
  id: string;
  type: 'DEBIT' | 'CREDIT';
  documentType: string;
  documentNo: string | null;
  documentDate: string;
  amount: MoneyString;
  currencyCode: string;
  amountTry: MoneyString;
  description: string | null;
  invoiceId: string | null;
  runningBalance: MoneyString;
}

const LIMIT = 20;
const RANGES = [
  { key: 'all', label: tr.statement.all, days: 0 },
  { key: 'd30', label: tr.statement.last30, days: 30 },
  { key: 'd90', label: tr.statement.last90, days: 90 },
] as const;

/** §13 Faz 1 — Ekstre: tarih filtresi + yuruyen bakiye + sonsuz kaydirma. */
export default function StatementScreen() {
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('all');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = fromDate(RANGES.find((r) => r.key === range)!.days);

  const query = useInfiniteQuery({
    queryKey: ['statement', range],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGetPaged<StatementLine>(
        `/buyers/me/statement?page=${pageParam}&limit=${LIMIT}${from ? `&from=${from}` : ''}`,
      ),
    getNextPageParam: (last) => {
      const loaded = last.meta.page * last.meta.limit;
      return loaded < last.meta.total ? last.meta.page + 1 : undefined;
    },
  });

  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ {tr.common.back}</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{tr.statement.title}</Text>
          <Pressable
            style={styles.pdfButton}
            disabled={sharing}
            onPress={() => {
              setSharing(true);
              shareStatementPdf('ekstre')
                .catch(() => setError(tr.common.error))
                .finally(() => setSharing(false));
            }}
          >
            <Text style={styles.pdfButtonText}>
              {sharing ? tr.statement.preparing : tr.statement.sharePdf}
            </Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.filters}>
        {RANGES.map((r) => (
          <Pressable
            key={r.key}
            style={[styles.chip, range === r.key && styles.chipActive]}
            onPress={() => setRange(r.key)}
          >
            <Text style={[styles.chipText, range === r.key && styles.chipTextActive]}>
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListEmptyComponent={
          query.isLoading ? <ActivityIndicator /> : <Text style={styles.hint}>{tr.home.empty}</Text>
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} />
          ) : rows.length > 0 && !query.hasNextPage ? (
            <Text style={styles.footerText}>{tr.statement.end}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            disabled={!item.invoiceId}
            onPress={() => item.invoiceId && router.push(`/fatura/${item.invoiceId}`)}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>{item.description ?? item.documentType}</Text>
              <Text style={styles.rowMeta}>
                {trDate(item.documentDate)}
                {item.documentNo ? ` · ${item.documentNo}` : ''}
              </Text>
            </View>

            <View style={styles.rowRight}>
              <Text
                style={[styles.amount, { color: item.type === 'DEBIT' ? '#dc2626' : '#059669' }]}
              >
                {item.type === 'DEBIT' ? '+' : '−'}
                {money(item.amount, item.currencyCode)}
              </Text>
              {/* Kural #2: yuruyen bakiye sunucuda window function ile turetilir (§6.4). */}
              <Text style={[styles.running, { color: balanceColor(item.runningBalance) }]}>
                {money(item.runningBalance)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function fromDate(days: number): string | null {
  if (days === 0) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: { color: '#64748b', fontSize: 14 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  pdfButton: {
    borderWidth: 1,
    borderColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pdfButtonText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  error: { color: '#b91c1c', fontSize: 12, marginTop: 6 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 12, color: '#334155' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowRight: { alignItems: 'flex-end' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  rowMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '600' },
  running: { fontSize: 12, marginTop: 2 },
  hint: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 24 },
  footer: { marginVertical: 16 },
  footerText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginVertical: 16 },
});
