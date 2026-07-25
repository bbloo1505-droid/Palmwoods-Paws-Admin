import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AUTH_DISABLED, LOCAL_OWNER_ID } from "@/lib/config";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  ownerId: string;
  loading: boolean;
  configured: boolean;
  authDisabled: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const localUser = {
  id: LOCAL_OWNER_ID,
  email: "anna@palmwoodspaws.local",
  app_metadata: {},
  user_metadata: { full_name: "Anna" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as User;

const localProfile: Profile = {
  id: LOCAL_OWNER_ID,
  full_name: "Anna",
  email: "anna@palmwoodspaws.local",
  created_at: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(AUTH_DISABLED ? localProfile : null);
  const [loading, setLoading] = useState(!AUTH_DISABLED);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile((data as Profile | null) ?? (AUTH_DISABLED ? localProfile : null));
  }, []);

  const refreshProfile = useCallback(async () => {
    const id = session?.user?.id ?? (AUTH_DISABLED ? LOCAL_OWNER_ID : null);
    if (!id) return;
    await loadProfile(id);
  }, [loadProfile, session?.user?.id]);

  useEffect(() => {
    if (AUTH_DISABLED) {
      setProfile(localProfile);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        void loadProfile(data.session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void loadProfile(next.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (AUTH_DISABLED) return { error: null };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (AUTH_DISABLED) return { error: null };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (AUTH_DISABLED) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const activeUser = AUTH_DISABLED ? localUser : (session?.user ?? null);
  const ownerId = activeUser?.id ?? LOCAL_OWNER_ID;

  const value = useMemo<AuthContextValue>(
    () => ({
      session: AUTH_DISABLED ? null : session,
      user: activeUser,
      profile: profile ?? (AUTH_DISABLED ? localProfile : null),
      ownerId,
      loading,
      configured: isSupabaseConfigured,
      authDisabled: AUTH_DISABLED,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, activeUser, profile, ownerId, loading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
