import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase.ts";
import * as authService from "@/services/auth.ts";
import type { UserRole } from "@/lib/supabase.types.ts";
import type { AuthUser } from "@/services/auth.ts";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (params: { name: string; email: string; password: string; role: UserRole }) => Promise<void>;
  loginWithMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, phone, avatar_url, is_suspended")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  const row = data as {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone: string | null;
    avatar_url: string | null;
    is_suspended: boolean;
  };
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    avatar_url: row.avatar_url ?? null,
    is_suspended: row.is_suspended,
  };
}

/** Build minimal AuthUser from Supabase auth user when public.users row is missing or not yet visible. */
function authUserFromSessionUser(sessionUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AuthUser {
  const meta = sessionUser.user_metadata ?? {};
  const role = (meta.role as UserRole) ?? "participant";
  return {
    id: sessionUser.id,
    name: (meta.name as string) ?? sessionUser.email ?? "User",
    email: sessionUser.email ?? "",
    role,
    phone: null,
    avatar_url: null,
    is_suspended: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setSessionProfile = useCallback(
    async (
      userId: string,
      accessToken: string,
      sessionUser?: { id: string; email?: string; user_metadata?: Record<string, unknown> }
    ) => {
      setToken(accessToken);
      if (sessionUser) {
        setUser(authUserFromSessionUser(sessionUser));
        fetchProfile(userId).then((profile) => {
          if (profile) setUser(profile);
        }).catch(() => {});
        return;
      }
      const profile = await fetchProfile(userId);
      setUser(profile);
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        await setSessionProfile(session.user.id, session.access_token, session.user);
      } else {
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          await setSessionProfile(session.user.id, session.access_token, session.user);
        } else {
          setUser(null);
          setToken(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setSessionProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authService.signInWithPassword(email, password);
      if (!result?.session?.user) throw new Error("No session after login");
      await setSessionProfile(
        result.session.user.id,
        result.session.access_token,
        result.session.user
      );
    },
    [setSessionProfile]
  );

  const loginWithMagicLink = useCallback(async (email: string) => {
    await authService.sendMagicLink(email);
  }, []);

  const register = useCallback(
    async (params: { name: string; email: string; password: string; role: UserRole }) => {
      const result = await authService.signUp(params);
      if (!result?.session?.user) {
        if (result?.user) {
          const profile = await fetchProfile(result.user.id);
          if (profile) {
            setUser(profile);
            setToken(result.session?.access_token ?? null);
          }
        }
        return;
      }
      await setSessionProfile(
        result.session.user.id,
        result.session.access_token,
        result.session.user
      );
    },
    [setSessionProfile]
  );

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        loginWithMagicLink,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
