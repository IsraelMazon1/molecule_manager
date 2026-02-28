"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Lab } from "@/types";

export default function DashboardPage() {
  const [labs, setLabs] = useState<Lab[] | null>(null);

  useEffect(() => {
    api.get<Lab[]>("/api/v1/labs/").then(setLabs);
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Your Labs</h1>
        <div className="flex gap-3">
          <Link
            href="/dashboard/labs/join"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Join a lab
          </Link>
          <Link
            href="/dashboard/labs/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Create lab
          </Link>
        </div>
      </div>

      <div className="mt-8">
        {labs === null ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : labs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
            <p className="text-sm font-medium text-zinc-500">
              You haven&apos;t joined any labs yet.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Link
                href="/dashboard/labs/join"
                className="font-medium text-zinc-700 hover:underline"
              >
                Join a lab
              </Link>
              <span className="text-zinc-300">or</span>
              <Link
                href="/dashboard/labs/new"
                className="font-medium text-zinc-900 hover:underline"
              >
                Create one
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map((lab) => (
              <Link
                key={lab.id}
                href={`/dashboard/labs/${lab.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-400 hover:shadow-sm"
              >
                <h2 className="font-semibold text-zinc-900">{lab.name}</h2>
                <p className="mt-1 font-mono text-xs text-zinc-400 tracking-widest">
                  {lab.lab_code}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
