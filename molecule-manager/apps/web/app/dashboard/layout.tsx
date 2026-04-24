"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
    }
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Redirecting to login...</p>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
          >
            Molecule Manager
          </Link>
          <div className="flex items-center gap-5">
            <NotificationBell />
            <span className="text-sm text-zinc-400">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
