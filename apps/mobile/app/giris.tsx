import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginSchema, type LoginInput, type LoginResponse } from '@carinet/shared';
import { ApiError, apiPublicPost, tokenStore } from '@/lib/api';
import { useSession } from '@/store/session';
import { tr } from '@/lib/tr';
import { color } from '@/lib/theme';

export default function LoginScreen() {
  const setSession = useSession((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await apiPublicPost<LoginResponse>('/auth/login', values);
      // kural #9: expo-secure-store. "Beni hatirla" kapaliysa token kalici YAZILMAZ.
      await tokenStore.save(result.tokens, remember);
      setSession(result.user, result.memberships);
      router.replace('/ana-sayfa');
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : tr.login.error);
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>{tr.app.name}</Text>
        <Text style={styles.title}>{tr.login.title}</Text>
        <Text style={styles.subtitle}>{tr.login.subtitle}</Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{tr.login.email}</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="username"
              />
              {errors.email ? <Text style={styles.error}>{errors.email.message}</Text> : null}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{tr.login.password}</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                secureTextEntry
                textContentType="password"
              />
              {errors.password ? <Text style={styles.error}>{errors.password.message}</Text> : null}
            </View>
          )}
        />

        <Pressable style={styles.remember} onPress={() => setRemember((v) => !v)}>
          <View style={[styles.checkbox, remember && styles.checkboxOn]}>
            {remember ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.rememberText}>{tr.login.remember}</Text>
        </Pressable>

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <Pressable style={styles.button} onPress={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{tr.login.submit}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  brand: { fontSize: 14, fontWeight: '600', color: color.ink[600], letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700', color: color.navy[900], marginTop: 4 },
  subtitle: { fontSize: 14, color: color.ink[600], marginTop: 4, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: color.ink[800], marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: color.white,
    fontSize: 15,
  },
  error: { color: color.debit, fontSize: 12, marginTop: 4 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: color.ink[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
  },
  checkboxOn: { backgroundColor: color.navy[900], borderColor: color.navy[900] },
  checkmark: { color: color.white, fontSize: 11, fontWeight: '700' },
  rememberText: { fontSize: 13, color: color.ink[800] },
  serverError: {
    color: color.debit,
    backgroundColor: color.debitSoft,
    padding: 8,
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: color.navy[900],
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: color.white, fontWeight: '600', fontSize: 15 },
});
