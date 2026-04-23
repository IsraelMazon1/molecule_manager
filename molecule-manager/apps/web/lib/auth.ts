"use client";

import { createContext, useContext } from "react";

import { api, ApiError } from "@/lib/api";
import type { User } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthState {
  /** null = not authenticated, undefined = still loading */
  user: User | null | undefined;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthState | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ─── Helper: session check ────────────────────────────────────────────────────

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const user = await api.get<User>("/api/v1/auth/me", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return user;
  } catch {
    return null;
  }
}
