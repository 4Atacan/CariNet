import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiDeleteBody } from '@/lib/api';
import { unregisterPush } from '@/lib/push';
import { useSession } from '@/store/session';
import { tr } from '@/lib/tr';
import { color } from '@/lib/theme';

/**
 * §11.6 (KVKK) — hesap silme. Apple/Google magaza kurali: hesap acabilen uygulama silme de sunmali.
 * Silme = ANONIMLESTIRME (§6.2): kimlik silinir, finansal kayitlar satici defterinde kalir.
 */
export default function DeleteAccountScreen() {
  const queryClient = useQueryClient();
  const clearSession = useSession((s) => s.clear);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: async () => {
      await unregisterPush();
      await apiDeleteBody<{ ok: true }>('/auth/account', { password, confirm });
    },
    onSuccess: async () => {
      await clearSession();
      queryClient.clear();
      router.replace('/giris');
    },
    onError: (e) => setError(e instanceof Error ? e.message : tr.common.error),
  });

  const canSubmit =
    password.length > 0 && confirm.trim() === tr.deleteAccount.confirmPhrase && !remove.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{tr.common.back}</Text>
        </Pressable>
        <Text style={styles.title}>{tr.deleteAccount.title}</Text>

        <View style={styles.warnCard}>
          <Text style={styles.warnText}>{tr.deleteAccount.intro}</Text>
        </View>
        <Text style={styles.note}>{tr.deleteAccount.financialNote}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>{tr.deleteAccount.passwordLabel}</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{tr.deleteAccount.confirmLabel}</Text>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          placeholder={tr.deleteAccount.confirmPhrase}
        />

        <Pressable
          style={[styles.deleteButton, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit}
          onPress={() => {
            setError(null);
            remove.mutate();
          }}
        >
          {remove.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteText}>{tr.deleteAccount.submit}</Text>
          )}
        </Pressable>

        <Pressable style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>{tr.deleteAccount.cancel}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  container: { padding: 20, gap: 10 },
  back: { color: color.ink[600], fontSize: 14 },
  title: { fontSize: 22, fontWeight: '700', color: color.navy[900], marginTop: 4 },
  warnCard: {
    backgroundColor: color.debitSoft,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: color.debitSoft,
  },
  warnText: { color: color.debit, fontSize: 14, lineHeight: 20 },
  note: { color: color.ink[600], fontSize: 13, lineHeight: 19 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: color.ink[600],
    textTransform: 'uppercase',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: color.white,
  },
  deleteButton: {
    backgroundColor: color.debit,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  deleteText: { color: color.white, fontWeight: '700' },
  cancel: { alignItems: 'center', marginTop: 12 },
  cancelText: { color: color.ink[600], fontSize: 14 },
  error: { backgroundColor: color.debitSoft, color: color.debit, padding: 10, borderRadius: 8 },
});
