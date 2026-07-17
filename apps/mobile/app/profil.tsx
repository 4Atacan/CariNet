import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, LogOut, ShieldCheck, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type AuthenticatedUser,
  type LoginResponse,
  type MembershipSummary,
} from '@carinet/shared';
import { AppHeader } from '@/components/app-header';
import { apiGet, apiPost, tokenStore } from '@/lib/api';
import { unregisterPush } from '@/lib/push';
import { color, radius, shadow, space } from '@/lib/theme';
import { tr } from '@/lib/tr';
import { useSession } from '@/store/session';

interface MeResponse extends AuthenticatedUser {
  memberships: MembershipSummary[];
}

/**
 * Profil — ana sayfadan tasinan seyler: hesap degistirici (§6.2), yasal baglantilar, cikis.
 * Ana sayfa artik yalniz "bakiyeni 3 saniyede gor" isine odaklanir; bunlar seyrek islerdir.
 */
export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const clearSession = useSession((s) => s.clear);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiGet<MeResponse>('/auth/me') });

  const switchAccount = useMutation({
    mutationFn: (membershipId: string) =>
      apiPost<LoginResponse>('/auth/switch-account', { membershipId }),
    onSuccess: async (result) => {
      await tokenStore.save(result.tokens); // yeni baglam → yeni token cifti (§6.2)
      await queryClient.invalidateQueries();
      router.replace('/ana-sayfa');
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      const refreshToken = await tokenStore.getRefresh();
      await unregisterPush(); // baska hesap bu cihazda bizim bildirimlerimizi almasin
      await apiPost<{ ok: true }>('/auth/logout', { refreshToken });
    },
    onSettled: async () => {
      await clearSession();
      queryClient.clear();
      router.replace('/giris');
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <AppHeader title={tr.header.profile} back />

      {me.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.navy[600]} />
        </View>
      ) : !me.data ? (
        <View style={styles.center}>
          <Text style={styles.hint}>{tr.common.error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(me.data.fullName)}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{me.data.fullName}</Text>
              {me.data.email ? <Text style={styles.meta}>{me.data.email}</Text> : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>{tr.switcher.title}</Text>
          <Text style={styles.hint}>{tr.switcher.hint}</Text>

          <View style={styles.group}>
            {me.data.memberships.map((m, i) => {
              const isActive = m.membershipId === me.data!.membershipId;
              return (
                <Pressable
                  key={m.membershipId}
                  style={[styles.row, i > 0 && styles.rowDivider, isActive && styles.rowActive]}
                  disabled={isActive || switchAccount.isPending}
                  onPress={() => switchAccount.mutate(m.membershipId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  {/* Aktif hesap: altin serit — panelin aktif sekmesiyle ayni dil. */}
                  {isActive ? <View style={styles.activeBar} /> : null}
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{m.sellerName}</Text>
                    <Text style={styles.rowMeta}>
                      {m.accountTitle ?? m.role}
                      {m.accountCode ? ` · ${m.accountCode}` : ''}
                    </Text>
                  </View>
                  {isActive ? (
                    <Text style={styles.activeTag}>{tr.switcher.active}</Text>
                  ) : (
                    <ChevronRight size={18} color={color.ink[400]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.group}>
            <LinkRow
              icon={<ShieldCheck size={18} color={color.ink[600]} />}
              label={tr.header.privacy}
              onPress={() => router.push('/gizlilik')}
            />
            <LinkRow
              icon={<Trash2 size={18} color={color.debit} />}
              label={tr.legal.deleteLink}
              tone={color.debit}
              divider
              onPress={() => router.push('/hesap-sil')}
            />
          </View>

          <Pressable
            style={styles.logout}
            onPress={() => logout.mutate()}
            accessibilityRole="button"
          >
            <LogOut size={18} color={color.ink[700]} />
            <Text style={styles.logoutText}>{tr.home.logout}</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  tone,
  divider,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  tone?: string;
  divider?: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, divider && styles.rowDivider]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {icon}
      <Text style={[styles.rowTitle, styles.linkLabel, tone ? { color: tone } : null]}>
        {label}
      </Text>
      <ChevronRight size={18} color={color.ink[400]} />
    </Pressable>
  );
}

/** "Ahmet Yilmaz" → "AY" */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const a = parts[0]![0] ?? '';
  const b = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (a + b).toLocaleUpperCase('tr-TR');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ink[100] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.navy[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: color.white, fontWeight: '700', fontSize: 15 },
  identityText: { flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '700', color: color.navy[900] },
  meta: { fontSize: 13, color: color.ink[600], marginTop: 2 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: color.navy[900], marginTop: space.sm },
  hint: { fontSize: 12, color: color.ink[600], lineHeight: 17 },

  group: {
    backgroundColor: color.white,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.ink[200],
    overflow: 'hidden',
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.ink[200] },
  rowActive: { backgroundColor: color.navy[50] },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: space.sm,
    bottom: space.sm,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: color.gold[500],
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: color.navy[900] },
  linkLabel: { flex: 1 },
  rowMeta: { fontSize: 12, color: color.ink[600], marginTop: 2 },
  activeTag: { fontSize: 11, fontWeight: '700', color: color.navy[700] },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    marginTop: space.sm,
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: color.ink[700] },
});
