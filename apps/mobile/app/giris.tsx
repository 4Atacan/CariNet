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

export default function LoginScreen() {
  const setSession = useSession((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

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
      await tokenStore.save(result.tokens); // kural #9: expo-secure-store
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
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  brand: { fontSize: 14, fontWeight: '600', color: '#64748b', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  error: { color: '#dc2626', fontSize: 12, marginTop: 4 },
  serverError: {
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
