"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Experiment, ExperimentDetail } from "@/types";

export default function ExperimentsPage() {
  const { labId } = useParams<{ labId: string }>();

  // Start with the lightweight list, then enrich with molecule counts
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    api.get<Experiment[]>(`/api/v1/labs/${labId}/experiments/`).then((list) => {
      setExperiments(list);

      // Fetch details for all experiments in parallel to get molecule counts
      Promise.all(
        list.map((exp) =>
          api
            .get<ExperimentDetail>(
              `/api/v1/labs/${labId}/experiments/${exp.id}`,
            )
            .then((d) => [exp.id, d.molecules.length] as const),
        ),
      ).then((pairs) => {
        setCounts(Object.fromEntries(pairs));
      });
    });
  }, [labId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/labs/${labId}`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            ← Lab dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            Experiments
          </h1>
        </div>
        <Link
          href={`/dashboard/labs/${labId}/experiments/new`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          New experiment
        </Link>
      </div>

      <div className="mt-8">
        {experiments === null ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : experiments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
            <p className="text-sm text-zinc-500">No experiments yet.</p>
            <Link
              href={`/dashboard/labs/${labId}/experiments/new`}
              className="mt-3 inline-block text-sm font-medium text-zinc-900 hover:underline"
            >
              Create the first experiment
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {experiments.map((exp) => (
              <Link
                key={exp.id}
                href={`/dashboard/labs/${labId}/experiments/${exp.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 truncate">
                    {exp.title}
                  </p>
                  {exp.notes && (
                    <p className="mt-0.5 truncate text-sm text-zinc-400">
                      {exp.notes}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-6 text-sm text-zinc-500">
                  <span>{exp.date}</span>
                  <span className="tabular-nums">
                    {exp.id in counts ? (
                      <>
                        <span className="font-medium text-zinc-900">
                          {counts[exp.id]}
                        </span>{" "}
                        {counts[exp.id] === 1 ? "molecule" : "molecules"}
                      </>
                    ) : (
                      <span className="inline-block h-3 w-10 animate-pulse rounded bg-zinc-100" />
                    )}
                  </span>
                  <span className="text-zinc-300">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
