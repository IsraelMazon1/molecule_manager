"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Molecule } from "@/types";

function PropRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2.5 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900">{value}</span>
    </div>
  );
}

export default function MoleculeDetailPage() {
  const { labId, moleculeId } = useParams<{
    labId: string;
    moleculeId: string;
  }>();
  const router = useRouter();

  const [mol, setMol] = useState<Molecule | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    api
      .get<Molecule>(`/api/v1/labs/${labId}/molecules/${moleculeId}`)
      .then(setMol)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [labId, moleculeId]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/api/v1/labs/${labId}/molecules/${moleculeId}`);
      router.push(`/dashboard/labs/${labId}/molecules`);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Delete failed. Please try again.",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (notFound || !mol) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-500">Molecule not found.</p>
        <Link
          href={`/dashboard/labs/${labId}/molecules`}
          className="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline"
        >
          ← Back to molecules
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
            href={`/dashboard/labs/${labId}/molecules`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            ← Molecules
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {mol.name}
          </h1>
          {mol.molecular_formula && (
            <p className="mt-0.5 font-mono text-sm text-zinc-500">
              {mol.molecular_formula}
            </p>
          )}
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Structure */}
        <div className="flex flex-col gap-4">
          {mol.svg_image ? (
            <div
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              style={{ height: 300, width: 300 }}
              dangerouslySetInnerHTML={{ __html: mol.svg_image }}
            />
          ) : (
            <div className="flex h-[300px] w-[300px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-400">
              No structure image
            </div>
          )}

          {/* SMILES */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="mb-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              SMILES
            </p>
            <p className="break-all font-mono text-xs text-zinc-700">
              {mol.canonical_smiles ?? mol.smiles}
            </p>
          </div>
        </div>

        {/* Properties + metadata */}
        <div className="space-y-4">
          {/* Physicochemical properties */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-zinc-900">
              Properties
            </h2>
            {mol.molecular_weight !== null && (
              <PropRow
                label="Molecular weight"
                value={`${mol.molecular_weight.toFixed(3)} g/mol`}
              />
            )}
            {mol.molecular_formula && (
              <PropRow label="Molecular formula" value={mol.molecular_formula} />
            )}
            {mol.hbd !== null && <PropRow label="H-bond donors" value={mol.hbd} />}
            {mol.hba !== null && (
              <PropRow label="H-bond acceptors" value={mol.hba} />
            )}
            {mol.tpsa !== null && (
              <PropRow label="TPSA" value={`${mol.tpsa.toFixed(2)} Å²`} />
            )}
            {mol.rotatable_bonds !== null && (
              <PropRow label="Rotatable bonds" value={mol.rotatable_bonds} />
            )}
          </div>

          {/* Record metadata */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-zinc-900">
              Record
            </h2>
            <PropRow label="Date created" value={mol.date_created} />
            <PropRow label="Method used" value={mol.method_used} />
          </div>

          {/* Notes */}
          {mol.notes && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900">
                Notes
              </h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-600">
                {mol.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
