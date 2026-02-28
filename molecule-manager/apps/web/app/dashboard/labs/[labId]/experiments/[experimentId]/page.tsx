"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { ExperimentDetail, Molecule } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SvgThumb({ svg }: { svg: string }) {
  return (
    <div
      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-white [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function NoStructure() {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
      —
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExperimentDetailPage() {
  const { labId, experimentId } = useParams<{
    labId: string;
    experimentId: string;
  }>();
  const router = useRouter();

  const [exp, setExp] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // attach panel state
  const [showAttach, setShowAttach] = useState(false);
  const [allMolecules, setAllMolecules] = useState<Molecule[] | null>(null);
  const [search, setSearch] = useState("");
  const [attaching, setAttaching] = useState<string | null>(null);
  const [detaching, setDetaching] = useState<string | null>(null);

  const fetchExp = useCallback(() => {
    api
      .get<ExperimentDetail>(
        `/api/v1/labs/${labId}/experiments/${experimentId}`,
      )
      .then(setExp)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [labId, experimentId]);

  useEffect(() => {
    fetchExp();
  }, [fetchExp]);

  // Load all lab molecules when the attach panel opens
  useEffect(() => {
    if (!showAttach) return;
    api
      .get<Molecule[]>(`/api/v1/labs/${labId}/molecules/`)
      .then(setAllMolecules);
  }, [showAttach, labId]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/api/v1/labs/${labId}/experiments/${experimentId}`);
      router.push(`/dashboard/labs/${labId}/experiments`);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Delete failed. Please try again.",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleAttach(moleculeId: string) {
    setAttaching(moleculeId);
    try {
      await api.post(
        `/api/v1/labs/${labId}/experiments/${experimentId}/molecules/${moleculeId}`,
      );
      fetchExp();
    } finally {
      setAttaching(null);
    }
  }

  async function handleDetach(moleculeId: string) {
    setDetaching(moleculeId);
    try {
      await api.delete(
        `/api/v1/labs/${labId}/experiments/${experimentId}/molecules/${moleculeId}`,
      );
      fetchExp();
    } finally {
      setDetaching(null);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const attachedIds = new Set(exp?.molecules.map((m) => m.id) ?? []);

  const filteredMolecules = (allMolecules ?? []).filter((m) => {
    const q = search.toLowerCase();
    return (
      !attachedIds.has(m.id) &&
      (m.name.toLowerCase().includes(q) ||
        (m.molecular_formula ?? "").toLowerCase().includes(q) ||
        m.smiles.toLowerCase().includes(q))
    );
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (notFound || !exp) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-500">Experiment not found.</p>
        <Link
          href={`/dashboard/labs/${labId}/experiments`}
          className="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline"
        >
          ← Back to experiments
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/labs/${labId}/experiments`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            ← Experiments
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {exp.title}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">{exp.date}</p>
        </div>

        {/* Delete control */}
        <div className="shrink-0">
          {deleteError && (
            <p className="mb-2 text-xs text-red-600">{deleteError}</p>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Are you sure?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-red-300 hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      {exp.notes && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-600">
            {exp.notes}
          </p>
        </div>
      )}

      {/* Molecules section */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Molecules{" "}
            <span className="ml-1 text-base font-normal text-zinc-400">
              ({exp.molecules.length})
            </span>
          </h2>
          <button
            onClick={() => setShowAttach((v) => !v)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {showAttach ? "Close" : "Attach molecule"}
          </button>
        </div>

        {/* Attach panel */}
        {showAttach && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
            <p className="mb-3 text-sm font-medium text-zinc-700">
              Add molecules from this lab
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, formula, or SMILES…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />

            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {allMolecules === null ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                </div>
              ) : filteredMolecules.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-400">
                  {search
                    ? "No molecules match your search."
                    : "All lab molecules are already attached."}
                </p>
              ) : (
                filteredMolecules.map((mol) => (
                  <div
                    key={mol.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3"
                  >
                    {mol.svg_image ? (
                      <SvgThumb svg={mol.svg_image} />
                    ) : (
                      <NoStructure />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900">
                        {mol.name}
                      </p>
                      <p className="font-mono text-xs text-zinc-400">
                        {mol.molecular_formula ?? mol.smiles}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAttach(mol.id)}
                      disabled={attaching === mol.id}
                      className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                    >
                      {attaching === mol.id ? "Adding…" : "Add"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Attached molecules list */}
        <div className="mt-4 space-y-3">
          {exp.molecules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
              <p className="text-sm text-zinc-500">No molecules attached yet.</p>
              <button
                onClick={() => setShowAttach(true)}
                className="mt-3 inline-block text-sm font-medium text-zinc-900 hover:underline"
              >
                Attach the first molecule
              </button>
            </div>
          ) : (
            exp.molecules.map((mol) => (
              <div
                key={mol.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4"
              >
                {mol.svg_image ? (
                  <SvgThumb svg={mol.svg_image} />
                ) : (
                  <NoStructure />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/labs/${labId}/molecules/${mol.id}`}
                    className="font-semibold text-zinc-900 hover:underline truncate block"
                  >
                    {mol.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-sm text-zinc-500">
                    {mol.molecular_formula ?? "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-zinc-400">
                    {mol.molecular_weight !== null && (
                      <span>MW {mol.molecular_weight.toFixed(2)} g/mol</span>
                    )}
                    <span>{mol.method_used}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDetach(mol.id)}
                  disabled={detaching === mol.id}
                  className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  {detaching === mol.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
