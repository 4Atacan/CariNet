import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MoneyString } from '@carinet/shared';
import { apiGetPaged } from '@/lib/api';
import { money } from '@/lib/format';
import { tr } from '@/lib/tr';

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{tr.common.back}</Text>
        </Pressable>
        <Text style={styles.title}>{tr.catalog.title}</Text>
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
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  back: { color: '#64748b', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  search: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  code: { fontSize: 12, color: '#94a3b8' },
  stock: { fontSize: 12, color: '#059669' },
  outOfStock: { color: '#dc2626' },
  price: { fontSize: 16, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
