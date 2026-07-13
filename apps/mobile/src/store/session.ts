import { create } from 'zustand';
import { type AuthenticatedUser, type MembershipSummary } from '@carinet/shared';
import { tokenStore } from '../lib/api';

/** Zustand YALNIZ oturum + aktif hesap icin (CLAUDE.md §2). Sunucu verisi TanStack Query'de. */
interface SessionState {
  user: AuthenticatedUser | null;
  memberships: MembershipSummary[];
  activeMembershipId: string | null;
  setSession: (user: AuthenticatedUser, memberships: MembershipSummary[]) => void;
  clear: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  memberships: [],
  activeMembershipId: null,
  setSession: (user, memberships) =>
    set({ user, memberships, activeMembershipId: user.membershipId }),
  clear: async () => {
    await tokenStore.clear();
    set({ user: null, memberships: [], activeMembershipId: null });
  },
}));
