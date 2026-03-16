// Copyright 2026 TheQuantAI
// Supabase Auth context provider for QuantStudio
// Replaces NextAuth SessionProvider + useSession()

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

interface AuthState {
  /** The current Supabase user (null when logged out) */
  user: AuthUser | null;
  /** Raw Supabase session (contains access_token for API calls) */
  session: Session | null;
  /** True while initial session is being loaded */
  isLoading: boolean;
  /** Sign out and clear session */
  signOut: () => Promise<void>;
  /** Get the current JWT access token (for cloud API calls) */
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  getAccessToken: () => null,
});

// ─── Helper: map Supabase User → AuthUser ───────────────────────

function mapUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      null,
    image: user.user_metadata?.avatar_url ?? null,
  };
}

// ─── Provider ───────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsLoading(false);
    });

    // 2. Listen for auth state changes (login, logout, token refresh, OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return session?.access_token ?? null;
  }, [session]);

  const user = useMemo(() => mapUser(session?.user ?? null), [session]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      isLoading,
      signOut: handleSignOut,
      getAccessToken,
    }),
    [user, session, isLoading, handleSignOut, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────

/**
 * Access the current auth state. Drop-in replacement for NextAuth's useSession().
 *
 * ```tsx
 * const { user, session, isLoading, signOut, getAccessToken } = useAuth();
 * ```
 */
export function useAuth() {
  return useContext(AuthContext);
}
