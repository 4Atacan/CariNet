import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MoneyString } from '@carinet/shared';
import { apiGetPaged } from '@/lib/api';
import { money } from '@/lib/format';
import { tr } from '@/lib/tr';
import { color } from '@/lib/theme';
import { AppHeader } from '@/components/app-header';

interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: MoneyString | null;
  quantity: string;
}

/** §13 Faz 4 — mobil vitrin. Alici YALNIZ aktif urunleri gorur (sunucu kisitlar). */
export default function CatalogScreen() {
  const [search, setSearch] = useState('');

  const products = useQuery({
    queryKey: ['catalog', search],
    queryFn: () =>
      apiGetPaged<Product>(
        `/products?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Sekme ekrani → geri dugmesi yok. */}
      <AppHeader title={tr.catalog.title} />
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder={tr.catalog.search}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={products.data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{tr.catalog.empty}</Text>}
        renderItem={({ item }) => {
          const inStock = Number(item.quantity) > 0;
          return (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.code}>
                  {item.code} · {item.unit}
                </Text>
                <Text style={[styles.stock, !inStock && styles.outOfStock]}>
                  {inStock
                    ? `${tr.catalog.inStock}: ${Number(item.quantity).toLocaleString('tr-TR')}`
                    : tr.catalog.outOfStock}
                </Text>
              </View>
              {item.price ? <Text style={styles.price}>{money(item.price)}</Text> : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  back: { color: color.ink[600], fontSize: 14 },
  title: { fontSize: 22, fontWeight: '600', color: color.navy[900] },
  search: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: color.white,
  },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: color.white,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: color.navy[900] },
  code: { fontSize: 12, color: color.ink[400] },
  stock: { fontSize: 12, color: color.credit },
  outOfStock: { color: color.debit },
  price: { fontSize: 16, fontWeight: '700', color: color.navy[900], fontVariant: ['tabular-nums'] },
  empty: { textAlign: 'center', color: color.ink[400], marginTop: 40 },
});
