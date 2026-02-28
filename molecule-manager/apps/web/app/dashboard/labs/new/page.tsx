"use client";

import Link from "next/link";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Lab } from "@/types";

export default function NewLabPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Lab | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const lab = await api.post<Lab>("/api/v1/labs/", { name, password });
      setCreated(lab);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <main className="mx-auto max-w-lg px-6 py-10">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-xl">
            ✓
          </div>
          <h2 className="mt-4 text-lg font-semibold text-green-900">
            Lab created!
          </h2>
          <p className="mt-1 text-sm text-green-700">
            Share this code with your team so they can join:
          </p>

          <div className="mt-5 rounded-lg border border-green-200 bg-white px-6 py-5">
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-zinc-900">
              {created.lab_code}
            </p>
          </div>

          <p className="mt-3 text-xs text-green-600">
            Members will also need the lab password you just set.
          </p>

          <Link
            href={`/dashboard/labs/${created.id}`}
            className="mt-6 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Go to lab →
          </Link>
        </div>
      </main>
    );
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
          Create a lab
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          A unique lab code will be generated for your team to join.
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
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700"
          >
            Lab name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smith Lab"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700"
          >
            Lab password
          </label>
          <p className="mt-0.5 text-xs text-zinc-400">
            Members will need this to join
          </p>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-zinc-700"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create lab"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Have a code?{" "}
        <Link
          href="/dashboard/labs/join"
          className="font-medium text-zinc-900 hover:underline"
        >
          Join a lab
        </Link>
      </p>
    </main>
  );
}
