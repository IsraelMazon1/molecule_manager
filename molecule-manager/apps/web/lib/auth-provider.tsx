"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { AuthContext, fetchCurrentUser } from "@/lib/auth";
import type { User } from "@/types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    fetchCurrentUser().then(setUser);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.post<User>("/api/v1/auth/login", { email, password });
    document.cookie = "logged_in=1; path=/; max-age=604800; SameSite=Lax";
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const u = await api.post<User>("/api/v1/auth/signup", { email, password });
    document.cookie = "logged_in=1; path=/; max-age=604800; SameSite=Lax";
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/v1/auth/logout");
    document.cookie = "logged_in=; path=/; max-age=0";
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
