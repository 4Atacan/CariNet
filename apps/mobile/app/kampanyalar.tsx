import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MoneyString } from '@carinet/shared';
import { apiGet, apiGetPaged } from '@/lib/api';
import { trDate } from '@/lib/format';
import { tr } from '@/lib/tr';

interface Campaign {
  id: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string;
}

interface ExchangeRate {
  date: string;
  currencyCode: string;
  rate: MoneyString;
}

/** §13 Faz 4 — yayindaki kampanyalar + guncel TCMB kurlari (tek ekran). */
export default function CampaignsScreen() {
  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiGetPaged<Campaign>('/campaigns?limit=50'),
  });

  const rates = useQuery({
    queryKey: ['rates'],
    queryFn: () => apiGet<ExchangeRate[]>('/exchange-rates/latest'),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={campaigns.data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.back}>{tr.common.back}</Text>
            </Pressable>

            <Text style={styles.title}>{tr.rates.title}</Text>
            <View style={styles.rateRow}>
              {(rates.data ?? []).map((rate) => (
                <View key={rate.currencyCode} style={styles.rateChip}>
                  <Text style={styles.rateCode}>{rate.currencyCode}</Text>
                  <Text style={styles.rateValue}>
                    {Number(rate.rate).toLocaleString('tr-TR', { minimumFractionDigits: 4 })}
                  </Text>
                </View>
              ))}
              {(rates.data ?? []).length === 0 ? (
                <Text style={styles.empty}>{tr.rates.empty}</Text>
              ) : null}
            </View>
            <Text style={styles.hint}>{tr.rates.hint}</Text>

            <Text style={[styles.title, styles.spaced]}>{tr.campaigns.title}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{tr.campaigns.empty}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.date}>
              {tr.campaigns.until}: {trDate(item.endsAt)}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 16, gap: 10 },
  headerBlock: { gap: 8, marginBottom: 8 },
  back: { color: '#64748b', fontSize: 14 },
  title: { fontSize: 20, fontWeight: '600', color: '#0f172a' },
  spaced: { marginTop: 16 },
  rateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rateChip: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  rateCode: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  rateValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  hint: { fontSize: 11, color: '#94a3b8', lineHeight: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cardBody: { fontSize: 14, color: '#475569', lineHeight: 19 },
  date: { fontSize: 11, color: '#94a3b8' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 12 },
});
