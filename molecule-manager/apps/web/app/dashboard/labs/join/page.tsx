"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Lab } from "@/types";

export default function JoinLabPage() {
  const router = useRouter();

  const [labCode, setLabCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const lab = await api.post<Lab>("/api/v1/labs/join", {
        lab_code: labCode.trim().toUpperCase(),
        password,
      });
      router.push(`/dashboard/labs/${lab.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isNotFound) setError("Lab not found. Check the code and try again.");
        else if (err.isUnauthorized) setError("Incorrect password.");
        else if (err.isConflict) setError("You're already a member of this lab.");
        else setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Join a lab
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the code and password provided by your lab admin.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div>
          <label
            htmlFor="lab_code"
            className="block text-sm font-medium text-zinc-700"
          >
            Lab code
          </label>
          <input
            id="lab_code"
            required
            value={labCode}
            onChange={(e) => setLabCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            spellCheck={false}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm uppercase tracking-widest text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700"
          >
            Lab password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Joining…" : "Join lab"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Want to start your own?{" "}
        <Link
          href="/dashboard/labs/new"
          className="font-medium text-zinc-900 hover:underline"
        >
          Create a lab
        </Link>
      </p>
    </main>
  );
}
