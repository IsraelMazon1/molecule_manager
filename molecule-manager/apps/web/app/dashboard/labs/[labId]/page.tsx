"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Experiment, Lab, Molecule } from "@/types";

export default function LabPage() {
  const { labId } = useParams<{ labId: string }>();

  const [lab, setLab] = useState<Lab | null>(null);
  const [molecules, setMolecules] = useState<Molecule[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Lab>(`/api/v1/labs/${labId}`),
      api.get<Molecule[]>(`/api/v1/labs/${labId}/molecules/`),
      api.get<Experiment[]>(`/api/v1/labs/${labId}/experiments/`),
    ])
      .then(([l, m, e]) => {
        setLab(l);
        setMolecules(m);
        setExperiments(e);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [labId]);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (notFound || !lab) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-500">Lab not found.</p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ← All labs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {lab.name}
        </h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          Lab code:{" "}
          <span className="font-mono font-medium tracking-widest text-zinc-600">
            {lab.lab_code}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm font-medium text-zinc-500">Molecules</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">
            {molecules.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm font-medium text-zinc-500">Experiments</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">
            {experiments.length}
          </p>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href={`/dashboard/labs/${labId}/molecules`}
          className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-400 hover:shadow-sm"
        >
          <div>
            <h2 className="font-semibold text-zinc-900">Molecules</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Add, search, and view molecule structures
            </p>
          </div>
          <span className="text-xl text-zinc-300 transition-colors group-hover:text-zinc-600">
            →
          </span>
        </Link>

        <Link
          href={`/dashboard/labs/${labId}/experiments`}
          className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-400 hover:shadow-sm"
        >
          <div>
            <h2 className="font-semibold text-zinc-900">Experiments</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Organize experiments and attach molecules
            </p>
          </div>
          <span className="text-xl text-zinc-300 transition-colors group-hover:text-zinc-600">
            →
          </span>
        </Link>
      </div>
    </main>
  );
}
