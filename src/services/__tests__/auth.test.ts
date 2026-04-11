import { describe, it, expect, vi } from "vitest";
import { supabase } from "@/lib/supabase.ts";
import {
  signInWithPassword,
  signUp,
  sendMagicLink,
  sendPasswordReset,
  signOut,
} from "@/services/auth.ts";

vi.mock("@/lib/supabase.ts");

const mockedSupabase = supabase as unknown as {
  auth: {
    signUp: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    signInWithOtp: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
  };
};

describe("auth service", () => {
  it("signInWithPassword succeeds on happy path", async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    } as any);

    const result = await signInWithPassword("test@example.com", "password");
    expect(result.user?.id).toBe("u1");
    expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password",
    });
  });

  it("signInWithPassword throws on error", async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid login credentials" },
    } as any);

    await expect(
      signInWithPassword("bad@test.com", "wrong"),
    ).rejects.toThrow("Invalid login credentials");
  });

  it("signUp succeeds on happy path", async () => {
    mockedSupabase.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: "u2" } },
      error: null,
    } as any);

    const result = await signUp({
      email: "new@example.com",
      password: "password",
      name: "New User",
      role: "organizer" as any,
    });

    expect(result.user?.id).toBe("u2");
    expect(mockedSupabase.auth.signUp).toHaveBeenCalled();
  });

  it("signUp throws on error", async () => {
    mockedSupabase.auth.signUp.mockResolvedValueOnce({
      data: null,
      error: { message: "Sign up failed" },
    } as any);

    await expect(
      signUp({
        email: "x@example.com",
        password: "pass",
        name: "X",
        role: "traveller" as any,
      }),
    ).rejects.toThrow("Sign up failed");
  });

  it("sendMagicLink throws on error", async () => {
    mockedSupabase.auth.signInWithOtp.mockResolvedValueOnce({
      error: { message: "otp error" },
    } as any);

    await expect(sendMagicLink("x@example.com")).rejects.toThrow("otp error");
  });

  it("sendPasswordReset throws on error", async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: { message: "reset error" },
    } as any);

    await expect(
      sendPasswordReset("x@example.com"),
    ).rejects.toThrow("reset error");
  });

  it("signOut throws on error", async () => {
    mockedSupabase.auth.signOut.mockResolvedValueOnce({
      error: { message: "signout error" },
    } as any);

    await expect(signOut()).rejects.toThrow("signout error");
  });
});

