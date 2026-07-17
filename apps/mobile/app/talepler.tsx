import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGetPaged, apiPost } from '@/lib/api';
import { trDate } from '@/lib/format';
import { tr } from '@/lib/tr';
import { color } from '@/lib/theme';

type RequestType = keyof typeof tr.requests.types;
type RequestStatus = keyof typeof tr.requests.statuses;

interface SupportRequest {
  id: string;
  type: RequestType;
  subject: string;
  body: string;
  status: RequestStatus;
  reply: string | null;
  createdAt: string;
}

const TYPES: RequestType[] = ['SUGGESTION', 'COMPLAINT', 'RECONCILIATION_OBJECTION', 'OTHER'];

/** §13 Faz 4 — Talep-Oneri. §9: devir mutabakatina itiraz da buradan akar. */
export default function RequestsScreen() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ type: 'SUGGESTION' as RequestType, subject: '', body: '' });
  const [error, setError] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ['requests'],
    queryFn: () => apiGetPaged<SupportRequest>('/requests?limit=50'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/requests', { type: form.type, subject: form.subject, body: form.body }),
    onSuccess: async () => {
      setForm({ type: 'SUGGESTION', subject: '', body: '' });
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : tr.common.error),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={requests.data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.back}>{tr.common.back}</Text>
            </Pressable>
            <Text style={styles.title}>{tr.requests.title}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.form}>
              <Text style={styles.label}>{tr.requests.type}</Text>
              <View style={styles.typeRow}>
                {TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.chip, form.type === type && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, type }))}
                  >
                    <Text style={[styles.chipText, form.type === type && styles.chipTextActive]}>
                      {tr.requests.types[type]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder={tr.requests.subject}
                value={form.subject}
                onChangeText={(subject) => setForm((f) => ({ ...f, subject }))}
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder={tr.requests.body}
                multiline
                value={form.body}
                onChangeText={(body) => setForm((f) => ({ ...f, body }))}
              />

              <Pressable
                style={[
                  styles.button,
                  (!form.subject || !form.body || create.isPending) && styles.buttonDisabled,
                ]}
                disabled={!form.subject || !form.body || create.isPending}
                onPress={() => {
                  setError(null);
                  create.mutate();
                }}
              >
                {create.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{tr.requests.send}</Text>
                )}
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{tr.requests.empty}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.badge}>{tr.requests.types[item.type]}</Text>
              <Text style={styles.status}>{tr.requests.statuses[item.status]}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.subject}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.date}>{trDate(item.createdAt)}</Text>

            {item.reply ? (
              <View style={styles.reply}>
                <Text style={styles.replyLabel}>{tr.requests.reply}</Text>
                <Text style={styles.replyBody}>{item.reply}</Text>
              </View>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  list: { padding: 16, gap: 10 },
  headerBlock: { gap: 8, marginBottom: 8 },
  back: { color: color.ink[600], fontSize: 14 },
  title: { fontSize: 22, fontWeight: '600', color: color.navy[900] },
  form: { backgroundColor: color.white, borderRadius: 12, padding: 14, gap: 8, marginTop: 8 },
  label: { fontSize: 12, fontWeight: '600', color: color.ink[600], textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: { backgroundColor: color.navy[900], borderColor: color.navy[900] },
  chipText: { fontSize: 12, color: color.ink[800] },
  chipTextActive: { color: color.white },
  input: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  button: {
    backgroundColor: color.navy[900],
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: color.white, fontWeight: '600' },
  card: { backgroundColor: color.white, borderRadius: 12, padding: 14, gap: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  badge: { fontSize: 11, fontWeight: '600', color: color.ink[600], textTransform: 'uppercase' },
  status: { fontSize: 11, fontWeight: '600', color: color.navy[900] },
  cardTitle: { fontSize: 15, fontWeight: '600', color: color.navy[900] },
  cardBody: { fontSize: 14, color: color.ink[700], lineHeight: 19 },
  date: { fontSize: 11, color: color.ink[400] },
  reply: {
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: color.credit,
    backgroundColor: color.creditSoft,
    padding: 10,
    borderRadius: 6,
  },
  replyLabel: { fontSize: 11, fontWeight: '600', color: color.credit },
  replyBody: { fontSize: 14, color: color.credit },
  error: { backgroundColor: color.debitSoft, color: color.debit, padding: 10, borderRadius: 8 },
  empty: { textAlign: 'center', color: color.ink[400], marginTop: 20 },
});
