import { useMutation, useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MoneyString } from '@carinet/shared';
import { apiGet, apiPost } from '@/lib/api';
import { money } from '@/lib/format';
import { tr } from '@/lib/tr';
import { color } from '@/lib/theme';

interface Dashboard {
  account: { accountCode: string; title: string };
  balance: { balance: MoneyString };
}

interface Installment {
  count: number;
  totalAmount: MoneyString;
  monthlyAmount: MoneyString;
  surchargePercent: number;
}

interface IntentResult {
  intent: {
    id: string;
    referenceCode: string;
    amount: MoneyString;
    channel: 'BANK_TRANSFER' | 'CARD_POS';
    expiresAt: string;
  };
  bankAccounts: { bankName: string; iban: string; holderName: string }[];
  payment: {
    hostedUrl: string;
    fields: Record<string, string>;
    debtAmount: MoneyString;
    chargeAmount: MoneyString;
    installmentCount: number;
  } | null;
}

/**
 * §8 — mobil "Odeme Yap". Iki kanal:
 *   Havale: referans kodu + saticinin IBAN'i (kopyala/paylas).
 *   Kart:   saglayicinin HOSTED 3D sayfasi acilir — kart alani bu uygulamada YOKTUR (kural #5).
 */
export default function PayScreen() {
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<'BANK_TRANSFER' | 'CARD_POS'>('BANK_TRANSFER');
  const [installmentCount, setInstallmentCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<Dashboard>('/buyers/me'),
  });

  /** Saticinin kart kanali acik mi? Taksit ucu POS yoksa hata doner → kart secenegi gizlenir. */
  const installments = useQuery({
    queryKey: ['installments', amount],
    queryFn: () => apiGet<Installment[]>(`/collections/installments?amount=${amount}`),
    enabled: Number(amount) > 0,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<IntentResult>('/collections/intents', {
        amount,
        channel,
        ...(channel === 'CARD_POS' ? { installmentCount } : {}),
      }),
    onError: (e) => setError(e instanceof Error ? e.message : tr.common.error),
  });

  const balance = dashboard.data?.balance.balance ?? '0.00';
  const cardAvailable = installments.isSuccess && (installments.data?.length ?? 0) > 0;

  if (create.data) {
    return <Result result={create.data} onReset={() => create.reset()} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>{tr.common.back}</Text>
          </Pressable>
          <Text style={styles.title}>{tr.pay.title}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>{tr.pay.amount}</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
          />
          <Pressable onPress={() => setAmount(balance)}>
            <Text style={styles.link}>
              {tr.pay.payAll} ({money(balance)})
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{tr.pay.channel}</Text>
          <View style={styles.row}>
            <Choice
              active={channel === 'BANK_TRANSFER'}
              label={tr.pay.bankTransfer}
              onPress={() => setChannel('BANK_TRANSFER')}
            />
            {cardAvailable ? (
              <Choice
                active={channel === 'CARD_POS'}
                label={tr.pay.card}
                onPress={() => setChannel('CARD_POS')}
              />
            ) : null}
          </View>

          {channel === 'CARD_POS' ? (
            <View style={styles.installments}>
              <Text style={styles.label}>{tr.pay.installment}</Text>
              {(installments.data ?? []).map((option) => (
                <Pressable
                  key={option.count}
                  style={[styles.option, installmentCount === option.count && styles.optionActive]}
                  onPress={() => setInstallmentCount(option.count)}
                >
                  <Text style={styles.optionLabel}>
                    {option.count === 1 ? tr.pay.single : `${option.count} taksit`}
                  </Text>
                  <Text style={styles.optionValue}>
                    {money(option.totalAmount)}
                    {option.count > 1 ? ` · ${money(option.monthlyAmount)}/ay` : ''}
                  </Text>
                </Pressable>
              ))}
              <Text style={styles.hint}>{tr.pay.surchargeHint}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[styles.button, (!amount || create.isPending) && styles.buttonDisabled]}
          disabled={!amount || create.isPending}
          onPress={() => {
            setError(null);
            create.mutate();
          }}
        >
          {create.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{tr.pay.submit}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Result({ result, onReset }: { result: IntentResult; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const { intent, bankAccounts, payment } = result;
  const account = bankAccounts[0];

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
  };

  /** Hosted 3D: alanlar imzali; tarayicida saglayicinin sayfasi acilir (kural #5). */
  const openHosted = async () => {
    if (!payment) return;
    const query = new URLSearchParams(payment.fields).toString();
    await Linking.openURL(`${payment.hostedUrl}?${query}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>{tr.common.back}</Text>
          </Pressable>
          <Text style={styles.title}>{tr.pay.pending}</Text>
        </View>

        {payment ? (
          <View style={styles.card}>
            <Text style={styles.hint}>{tr.pay.providerHint}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>{tr.pay.chargeNote}</Text>
              <Text style={styles.amountBig}>{money(payment.chargeAmount)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>{tr.pay.debtNote}</Text>
              <Text style={styles.amountSmall}>{money(payment.debtAmount)}</Text>
            </View>
            <Text style={styles.hint}>{tr.pay.surchargeHint}</Text>
            <Pressable style={styles.button} onPress={() => void openHosted()}>
              <Text style={styles.buttonText}>{tr.pay.goToProvider}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>{tr.pay.referenceTitle}</Text>
              <Text style={styles.reference}>{intent.referenceCode}</Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.smallButton}
                  onPress={() => void copy(intent.referenceCode)}
                >
                  <Text style={styles.smallButtonText}>{copied ? tr.pay.copied : tr.pay.copy}</Text>
                </Pressable>
                <Pressable
                  style={styles.smallButton}
                  onPress={() =>
                    void Share.share({
                      message: `${tr.pay.referenceTitle}: ${intent.referenceCode}\n${
                        account ? `${tr.pay.iban}: ${account.iban}` : ''
                      }\n${money(intent.amount)}`,
                    })
                  }
                >
                  <Text style={styles.smallButtonText}>{tr.pay.share}</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>{tr.pay.referenceHint}</Text>
            </View>

            {account ? (
              <View style={styles.card}>
                <Text style={styles.label}>{account.bankName}</Text>
                <Text style={styles.iban}>{account.iban}</Text>
                <Text style={styles.hint}>
                  {tr.pay.holder}: {account.holderName}
                </Text>
                <Pressable style={styles.smallButton} onPress={() => void copy(account.iban)}>
                  <Text style={styles.smallButtonText}>{tr.pay.copy}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>{tr.pay.amount}</Text>
          <Text style={styles.amountBig}>{money(intent.amount)}</Text>
        </View>
        <Text style={styles.hint}>{tr.pay.done}</Text>

        <Pressable style={styles.secondaryButton} onPress={onReset}>
          <Text style={styles.secondaryButtonText}>{tr.pay.newRequest}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  container: { padding: 16, gap: 12 },
  header: { gap: 4, marginBottom: 4 },
  back: { color: color.ink[600], fontSize: 14 },
  title: { fontSize: 22, fontWeight: '600', color: color.navy[900] },
  card: { backgroundColor: color.white, borderRadius: 12, padding: 16, gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: color.ink[600], textTransform: 'uppercase' },
  amountInput: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    color: color.navy[900],
  },
  link: { color: color.navy[900], fontSize: 13, textDecorationLine: 'underline' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  choiceActive: { backgroundColor: color.navy[900], borderColor: color.navy[900] },
  choiceText: { color: color.ink[800], fontWeight: '500' },
  choiceTextActive: { color: color.white },
  installments: { gap: 6, marginTop: 8 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: 8,
    padding: 10,
  },
  optionActive: { borderColor: color.navy[900], backgroundColor: color.ink[100] },
  optionLabel: { color: color.navy[900], fontWeight: '500' },
  optionValue: { color: color.ink[700], fontVariant: ['tabular-nums'] },
  button: {
    backgroundColor: color.navy[900],
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: color.white, fontWeight: '600', fontSize: 15 },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: color.ink[600], fontSize: 14 },
  smallButton: {
    borderWidth: 1,
    borderColor: color.ink[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallButtonText: { color: color.navy[900], fontSize: 13, fontWeight: '500' },
  reference: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    color: color.navy[900],
    fontFamily: 'monospace',
  },
  iban: { fontSize: 15, color: color.navy[900], fontFamily: 'monospace' },
  hint: { fontSize: 12, color: color.ink[600], lineHeight: 17 },
  error: { backgroundColor: color.debitSoft, color: color.debit, padding: 12, borderRadius: 8 },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  amountLabel: { color: color.ink[600], fontSize: 13 },
  amountBig: {
    fontSize: 20,
    fontWeight: '700',
    color: color.navy[900],
    fontVariant: ['tabular-nums'],
  },
  amountSmall: { fontSize: 15, color: color.ink[800], fontVariant: ['tabular-nums'] },
});
