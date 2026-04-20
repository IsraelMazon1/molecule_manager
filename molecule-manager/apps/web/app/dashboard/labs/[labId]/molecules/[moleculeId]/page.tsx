"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { sanitizeSvg } from "@/lib/sanitize";
import type { LabDetail, Molecule } from "@/types";

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
  const { user } = useAuth();

  const [mol, setMol] = useState<Molecule | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"PI" | "STUDENT">(
    "STUDENT",
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Molecule>(`/api/v1/labs/${labId}/molecules/${moleculeId}`),
      api.get<LabDetail>(`/api/v1/labs/${labId}`),
    ])
      .then(([molecule, lab]) => {
        setMol(molecule);
        const role =
          lab.members.find((m) => m.user_id === user?.id)?.role ?? "STUDENT";
        setCurrentUserRole(role);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [labId, moleculeId, user?.id]);

  function openEdit() {
    if (!mol) return;
    setEditName(mol.name);
    setEditDate(mol.date_created);
    setEditMethod(mol.method_used);
    setEditNotes(mol.notes ?? "");
    setSaveError("");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const updated = await api.patch<Molecule>(
        `/api/v1/labs/${labId}/molecules/${moleculeId}`,
        {
          name: editName || undefined,
          date_created: editDate || undefined,
          method_used: editMethod || undefined,
          notes: editNotes || undefined,
        },
      );
      setMol(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Save failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

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

  const canEditOrDelete =
    mol.created_by_user_id === user?.id || currentUserRole === "PI";

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

        {/* Action controls */}
        {canEditOrDelete && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {deleteError && (
              <p className="text-xs text-red-600">{deleteError}</p>
            )}
            <div className="flex items-center gap-2">
              {!editing && (
                <button
                  onClick={openEdit}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-500 hover:text-zinc-900"
                >
                  Edit
                </button>
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
        )}
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">
            Edit molecule
          </h2>
          {saveError && (
            <p className="mb-3 text-xs text-red-600">{saveError}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Date created
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Method used
              </label>
              <input
                value={editMethod}
                onChange={(e) => setEditMethod(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Notes
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Structure */}
        <div className="flex flex-col gap-4">
          {mol.svg_image ? (
            <div
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              style={{ height: 300, width: 300 }}
              dangerouslySetInnerHTML={{ __html: sanitizeSvg(mol.svg_image) }}
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
            {mol.inchikey && (
              <div className="flex items-center justify-between py-1.5 text-sm border-b border-zinc-100 last:border-0">
                <span className="text-zinc-500">InChIKey</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-zinc-700 break-all">
                    {mol.inchikey}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(mol.inchikey!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
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
