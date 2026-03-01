"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Experiment, LabDetail, LabMember, Molecule } from "@/types";

export default function LabPage() {
  const { labId } = useParams<{ labId: string }>();
  const { user } = useAuth();

  const [lab, setLab] = useState<LabDetail | null>(null);
  const [molecules, setMolecules] = useState<Molecule[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState("");

  function fetchLab() {
    return api.get<LabDetail>(`/api/v1/labs/${labId}`);
  }

  useEffect(() => {
    Promise.all([
      fetchLab(),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  async function handlePromote(member: LabMember) {
    setPromotingId(member.user_id);
    setPromoteError("");
    try {
      await api.patch(`/api/v1/labs/${labId}/members/${member.user_id}/role`, {
        role: "PI",
      });
      const updated = await fetchLab();
      setLab(updated);
    } catch (err) {
      setPromoteError(
        err instanceof ApiError ? err.message : "Failed to promote member.",
      );
    } finally {
      setPromotingId(null);
    }
  }

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

  const currentUserRole =
    lab.members.find((m) => m.user_id === user?.id)?.role ?? "STUDENT";
  const isPI = currentUserRole === "PI";

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

        {isPI && (
          <Link
            href={`/dashboard/labs/${labId}/audit`}
            className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-400 hover:shadow-sm sm:col-span-2"
          >
            <div>
              <h2 className="font-semibold text-zinc-900">Audit Log</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                View all lab activity — PI only
              </p>
            </div>
            <span className="text-xl text-zinc-300 transition-colors group-hover:text-zinc-600">
              →
            </span>
          </Link>
        )}
      </div>

      {/* Members section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">
          Members{" "}
          <span className="ml-1 text-base font-normal text-zinc-400">
            ({lab.members.length})
          </span>
        </h2>

        {promoteError && (
          <p className="mt-2 text-xs text-red-600">{promoteError}</p>
        )}

        <div className="mt-3 space-y-2">
          {lab.members.map((member) => {
            const isYou = member.user_id === user?.id;
            const canPromote = isPI && !isYou && member.role === "STUDENT";

            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-900">
                    {member.email}
                    {isYou && (
                      <span className="ml-1.5 text-xs text-zinc-400">
                        (you)
                      </span>
                    )}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.role === "PI"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {member.role}
                  </span>
                </div>

                {canPromote && (
                  <button
                    onClick={() => handlePromote(member)}
                    disabled={promotingId === member.user_id}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-amber-400 hover:text-amber-700 disabled:opacity-50"
                  >
                    {promotingId === member.user_id
                      ? "Promoting…"
                      : "Promote to PI"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
