import { supabase } from "@/lib/supabase.ts";
import type { UserRole } from "@/lib/supabase.types.ts";

const AUTH_REQUEST_TIMEOUT_MS = 20_000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ]);
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  avatar_url?: string | null;
  is_suspended: boolean;
}

export async function signUp(params: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}) {
  const promise = (async () => {
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          name: params.name,
          role: params.role,
        },
      },
    });
    if (error) throw new Error(error.message ?? "Sign up failed");
    return data;
  })();
  return withTimeout(
    promise,
    AUTH_REQUEST_TIMEOUT_MS,
    "Request timed out. Check your connection and try again.",
  );
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Supabase will redirect back here after the user clicks the email link.
      emailRedirectTo: window.location.origin + "/",
    },
  });
  if (error) throw new Error(error.message ?? "Failed to send magic link");
}

export async function signInWithPassword(email: string, password: string) {
  const promise = (async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message ?? "Invalid email or password");
    return data;
  })();
  return withTimeout(
    promise,
    AUTH_REQUEST_TIMEOUT_MS,
    "Request timed out. Check your connection and try again.",
  );
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message ?? "Sign out failed");
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password",
  });
  if (error) throw new Error(error.message ?? "Failed to send reset email");
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message ?? "Failed to update password");
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message ?? "Session error");
  return data.session;
}

export function getAccessToken(): string | null {
  // Session is synced by Supabase client; call getSession() for async
  return null;
}
