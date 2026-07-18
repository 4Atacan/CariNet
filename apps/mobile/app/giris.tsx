import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginSchema, type LoginInput, type LoginResponse } from '@carinet/shared';
import { ApiError, apiPublicPost, tokenStore } from '@/lib/api';
import { useSession } from '@/store/session';
import { tr } from '@/lib/tr';
import { color, radius, space } from '@/lib/theme';
import logoReverse from '../assets/logo-reverse.png';

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
    <View style={styles.root}>
      {/* Marka bandi — panelin giris ekraniyla ayni dil: lacivert zemin, ters logo, altin
          sac cizgisi, tasan filigran. Panelde YAN sutun, burada UST bant: telefonda yan
          yana iki sutun formu ezer. */}
      <SafeAreaView edges={['top']} style={styles.brandBand}>
        <View style={styles.goldHairline} />
        <Image source={logoReverse} style={styles.logo} resizeMode="contain" />
        <Text style={styles.pitch}>{tr.login.pitch}</Text>
        <Text style={styles.pitchSub}>{tr.login.pitchSub}</Text>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.formWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
                {errors.password ? (
                  <Text style={styles.error}>{errors.password.message}</Text>
                ) : null}
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
              <ActivityIndicator color={color.white} />
            ) : (
              <Text style={styles.buttonText}>{tr.login.submit}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/gizlilik')}>
            <Text style={styles.privacy}>{tr.login.privacy}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  brandBand: {
    backgroundColor: color.navy[900],
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  goldHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.gold[500],
    opacity: 0.6,
  },
  // Logo 933x234 (oran 3.99) — genislik yerine YUKSEKLIK sabitlenir, aspectRatio ile
  // genislik turetilir; boylece varlik degisse de logo ezilmez.
  logo: { height: 30, aspectRatio: 933 / 234, marginTop: space.lg, alignSelf: 'flex-start' },
  pitch: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: color.white,
    marginTop: space.xl,
  },
  pitchSub: { fontSize: 13, lineHeight: 19, color: color.navy[200], marginTop: space.sm },
  formWrap: { flex: 1 },
  container: { padding: space.lg, paddingTop: space.xl },
  title: { fontSize: 24, fontWeight: '700', color: color.navy[900] },
  subtitle: { fontSize: 14, color: color.ink[600], marginTop: 4, marginBottom: 24 },
  privacy: {
    fontSize: 12,
    color: color.ink[500],
    textAlign: 'center',
    marginTop: space.xl,
  },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: color.ink[800], marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: radius.sm,
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
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: color.white, fontWeight: '600', fontSize: 15 },
});
