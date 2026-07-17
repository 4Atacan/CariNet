import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MoneyString } from '@carinet/shared';
import { apiGet } from '@/lib/api';
import { money, trDate } from '@/lib/format';
import { tr } from '@/lib/tr';
import { color } from '@/lib/theme';

interface InvoiceDetail {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  currencyCode: string;
  exchangeRate: MoneyString;
  netTotal: MoneyString;
  taxTotal: MoneyString;
  grandTotal: MoneyString;
  isCancelled: boolean;
  items: {
    id: string;
    lineNo: number;
    name: string;
    unit: string;
    quantity: string;
    unitPrice: MoneyString;
    taxRate: string;
    lineTotal: MoneyString;
    /** Satir bazli kur (§7) — dovizli faturada her satir kendi kurunu tasir. */
    exchangeRate: MoneyString;
  }[];
}

/** §13 Faz 1 — Fatura detayi: kalemler + satir bazli kur. */
export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const invoice = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => apiGet<InvoiceDetail>(`/invoices/${id}`),
  });

  if (invoice.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (invoice.isError || !invoice.data) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.hint}>{tr.common.error}</Text>
      </SafeAreaView>
    );
  }

  const data = invoice.data;
  const foreign = data.currencyCode !== 'TRY';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ {tr.common.back}</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <Text style={styles.title}>{tr.invoice.title}</Text>
          {data.isCancelled ? <Text style={styles.cancelled}>{tr.invoice.cancelled}</Text> : null}
        </View>

        <View style={styles.card}>
          <Meta label={tr.invoice.invoiceNo} value={data.invoiceNo} />
          <Meta label={tr.invoice.date} value={trDate(data.invoiceDate)} />
          <Meta label={tr.invoice.dueDate} value={trDate(data.dueDate)} />
          {foreign ? <Meta label={tr.invoice.exchangeRate} value={data.exchangeRate} /> : null}
        </View>

        <Text style={styles.sectionTitle}>{tr.invoice.items}</Text>

        {data.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <Text style={styles.itemName}>
              {item.lineNo}. {item.name}
            </Text>
            <Text style={styles.itemMeta}>
              {item.quantity} {item.unit} × {money(item.unitPrice, data.currencyCode)} · %
              {item.taxRate}
            </Text>
            {foreign ? (
              <Text style={styles.itemMeta}>
                {tr.invoice.exchangeRate}: {item.exchangeRate}
              </Text>
            ) : null}
            <Text style={styles.itemTotal}>{money(item.lineTotal, data.currencyCode)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <Total label={tr.invoice.netTotal} value={money(data.netTotal, data.currencyCode)} />
          <Total label={tr.invoice.taxTotal} value={money(data.taxTotal, data.currencyCode)} />
          <Total
            label={tr.invoice.grandTotal}
            value={money(data.grandTotal, data.currencyCode)}
            strong
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.metaValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ink[100],
  },
  container: { padding: 20, paddingBottom: 40 },
  back: { color: color.ink[600], fontSize: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: color.navy[900] },
  cancelled: {
    backgroundColor: color.debitSoft,
    color: color.debit,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  card: {
    backgroundColor: color.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: color.ink[200],
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  metaLabel: { fontSize: 13, color: color.ink[600] },
  metaValue: { fontSize: 13, color: color.navy[900], fontWeight: '500' },
  strong: { fontSize: 15, fontWeight: '700', color: color.navy[900] },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: color.navy[900],
    marginTop: 24,
    marginBottom: 8,
  },
  item: {
    backgroundColor: color.white,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: color.ink[200],
    marginBottom: 8,
  },
  itemName: { fontSize: 14, fontWeight: '600', color: color.navy[900] },
  itemMeta: { fontSize: 12, color: color.ink[600], marginTop: 2 },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: color.navy[900],
    marginTop: 6,
    textAlign: 'right',
  },
  totals: {
    marginTop: 12,
    backgroundColor: color.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: color.ink[200],
  },
  hint: { fontSize: 13, color: color.ink[600] },
});
