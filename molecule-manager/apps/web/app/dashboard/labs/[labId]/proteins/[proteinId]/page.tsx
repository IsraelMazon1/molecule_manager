"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LabDetail, Protein } from "@/types";

const ProteinViewer = dynamic(() => import("@/components/ProteinViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
      Loading 3D viewer...
    </div>
  ),
});

type DisplayMode = "cartoon" | "surface" | "stick";

const SOURCE_LABELS: Record<string, string> = {
  pdb_id: "PDB ID lookup",
  name: "Name / gene search",
  sequence: "Amino acid sequence",
  manual: "Manual entry",
};

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2.5 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900">{value}</span>
    </div>
  );
}

export default function ProteinDetailPage() {
  const { labId, proteinId } = useParams<{
    labId: string;
    proteinId: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const [protein, setProtein] = useState<Protein | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"PI" | "STUDENT">(
    "STUDENT",
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [copiedField, setCopiedField] = useState("");

  // 3D viewer state
  const [pdbText, setPdbText] = useState<string | null>(null);
  const [pdbLoading, setPdbLoading] = useState(false);
  const [pdbError, setPdbError] = useState("");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cartoon");

  useEffect(() => {
    Promise.all([
      api.get<Protein>(`/api/v1/labs/${labId}/proteins/${proteinId}`),
      api.get<LabDetail>(`/api/v1/labs/${labId}`),
    ])
      .then(([p, lab]) => {
        setProtein(p);
        const role =
          lab.members.find((m) => m.user_id === user?.id)?.role ?? "STUDENT";
        setCurrentUserRole(role);

        if (p.pdb_id) {
          setPdbLoading(true);
          const apiBase = process.env.NEXT_PUBLIC_API_URL;
          if (!apiBase) throw new Error("NEXT_PUBLIC_API_URL is not configured");
          fetch(
            `${apiBase}/api/v1/labs/${labId}/proteins/${proteinId}/structure`,
            { credentials: "include" },
          )
            .then(async (res) => {
              if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(
                  body?.detail ?? `Failed to load structure (${res.status})`,
                );
              }
              return res.text();
            })
            .then(setPdbText)
            .catch((err) =>
              setPdbError(
                err instanceof Error ? err.message : "Failed to load PDB file",
              ),
            )
            .finally(() => setPdbLoading(false));
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [labId, proteinId, user?.id]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/api/v1/labs/${labId}/proteins/${proteinId}`);
      router.push(`/dashboard/labs/${labId}/proteins`);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Delete failed. Please try again.",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (notFound || !protein) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-500">Protein not found.</p>
        <Link
          href={`/dashboard/labs/${labId}/proteins`}
          className="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline"
        >
          &larr; Back to proteins
        </Link>
      </main>
    );
  }

  const canDelete =
    protein.created_by_user_id === user?.id || currentUserRole === "PI";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/labs/${labId}/proteins`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            &larr; Proteins
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {protein.name}
          </h1>
          {protein.display_name && protein.display_name !== protein.name && (
            <p className="mt-0.5 text-sm text-zinc-500">
              {protein.display_name}
            </p>
          )}
        </div>

        {canDelete && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {deleteError && (
              <p className="text-xs text-red-600">{deleteError}</p>
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
                  {deleting ? "Deleting..." : "Delete"}
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
        )}
      </div>

      {/* 3D Viewer */}
      <div className="mt-8">
        {protein.pdb_id ? (
          <div>
            {/* Display mode toggles */}
            <div className="mb-3 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 w-fit">
              {(
                [
                  ["cartoon", "Cartoon"],
                  ["surface", "Surface"],
                  ["stick", "Stick"],
                ] as [DisplayMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDisplayMode(mode)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    displayMode === mode
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Viewer container */}
            <div className="h-[600px] w-full rounded-xl border border-zinc-200 bg-white overflow-hidden">
              {pdbLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                </div>
              ) : pdbError ? (
                <div className="flex h-full items-center justify-center px-6">
                  <p className="text-sm text-red-600 text-center">{pdbError}</p>
                </div>
              ) : pdbText ? (
                <ProteinViewer pdbText={pdbText} displayMode={displayMode} />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50">
            <p className="text-sm text-zinc-400">
              No PDB ID associated with this protein — 3D structure
              visualization is not available.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Identifiers */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-zinc-900">
            Identifiers
          </h2>
          <PropRow
            label="Source"
            value={SOURCE_LABELS[protein.source] ?? protein.source}
          />
          {protein.uniprot_id && (
            <div className="flex items-center justify-between py-2.5 text-sm border-b border-zinc-100 last:border-0">
              <span className="text-zinc-500">UniProt ID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-medium text-zinc-900">
                  {protein.uniprot_id}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(protein.uniprot_id!, "uniprot")
                  }
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  {copiedField === "uniprot" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
          {protein.pdb_id && (
            <div className="flex items-center justify-between py-2.5 text-sm border-b border-zinc-100 last:border-0">
              <span className="text-zinc-500">PDB ID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-medium text-zinc-900">
                  {protein.pdb_id}
                </span>
                <button
                  onClick={() => copyToClipboard(protein.pdb_id!, "pdb")}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  {copiedField === "pdb" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Record metadata */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-zinc-900">Record</h2>
          <PropRow
            label="Created"
            value={new Date(protein.created_at).toLocaleString()}
          />
          <PropRow
            label="Updated"
            value={new Date(protein.updated_at).toLocaleString()}
          />
        </div>

        {/* Sequence */}
        {protein.sequence && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                Sequence{" "}
                <span className="font-normal text-zinc-400">
                  ({protein.sequence.length} residues)
                </span>
              </h2>
              <button
                onClick={() => copyToClipboard(protein.sequence!, "seq")}
                className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
              >
                {copiedField === "seq" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="break-all font-mono text-xs text-zinc-700 leading-relaxed">
              {protein.sequence}
            </p>
          </div>
        )}

        {/* Notes */}
        {protein.notes && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-600">
              {protein.notes}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
