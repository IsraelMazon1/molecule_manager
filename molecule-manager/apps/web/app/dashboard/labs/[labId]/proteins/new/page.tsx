"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Protein, ProteinResolution } from "@/types";

const SOURCE_LABELS: Record<string, string> = {
  pdb_id: "PDB ID lookup",
  name: "Name / gene search (UniProt)",
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

export default function NewProteinPage() {
  const { labId } = useParams<{ labId: string }>();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  // Step 2
  const [resolved, setResolved] = useState<ProteinResolution | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setResolving(true);
    setResolveError("");
    try {
      const result = await api.post<ProteinResolution>(
        `/api/v1/labs/${labId}/proteins/resolve`,
        { query: q },
      );
      setResolved(result);
      setStep(2);
    } catch (err) {
      setResolveError(
        err instanceof ApiError ? err.message : "Resolution failed. Please try again.",
      );
    } finally {
      setResolving(false);
    }
  }

  function handleBack() {
    setStep(1);
    setResolved(null);
    setNotes("");
    setSubmitError("");
  }

  async function handleSave() {
    if (!resolved) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const protein = await api.post<Protein>(
        `/api/v1/labs/${labId}/proteins/`,
        {
          name: resolved.name,
          display_name: resolved.display_name,
          uniprot_id: resolved.uniprot_id,
          pdb_id: resolved.pdb_id,
          sequence: resolved.sequence,
          source: resolved.source,
          notes: notes.trim() || null,
        },
      );
      router.push(`/dashboard/labs/${labId}/proteins/${protein.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Save failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/dashboard/labs/${labId}/proteins`}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          &larr; Proteins
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          New Protein
        </h1>
      </div>

      {/* Step 1: Query */}
      {step === 1 && (
        <form onSubmit={handleResolve} className="space-y-5">
          {resolveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {resolveError}
            </p>
          )}

          <div>
            <label
              htmlFor="query"
              className="block text-sm font-medium text-zinc-700"
            >
              Protein query <span className="text-red-500">*</span>
            </label>
            <p className="mt-0.5 text-xs text-zinc-400">
              Enter a protein name or gene (e.g. &quot;hemoglobin&quot;), a PDB
              ID (e.g. &quot;1MBO&quot;), or an amino acid sequence.
            </p>
            <input
              id="query"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. hemoglobin, 1MBO, MVLSPADKTN..."
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <button
            type="submit"
            disabled={resolving || !query.trim()}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {resolving ? "Resolving..." : "Resolve"}
          </button>
        </form>
      )}

      {/* Step 2: Preview and confirm */}
      {step === 2 && resolved && (
        <div className="space-y-5">
          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {submitError}
            </p>
          )}

          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="mb-3 text-xs font-medium text-green-700">
              Resolved via {SOURCE_LABELS[resolved.source] ?? resolved.source}
            </p>
            <PropRow label="Name" value={resolved.name} />
            {resolved.display_name && resolved.display_name !== resolved.name && (
              <PropRow label="Display name" value={resolved.display_name} />
            )}
            {resolved.uniprot_id && (
              <PropRow label="UniProt ID" value={resolved.uniprot_id} />
            )}
            {resolved.pdb_id && (
              <PropRow label="PDB ID" value={resolved.pdb_id} />
            )}
            {resolved.sequence && (
              <div className="border-b border-zinc-100 py-2.5 last:border-0">
                <span className="text-sm text-zinc-500">Sequence</span>
                <p className="mt-1 break-all font-mono text-xs text-zinc-700">
                  {resolved.sequence.length > 200
                    ? `${resolved.sequence.slice(0, 200)}...`
                    : resolved.sequence}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {resolved.sequence.length} residues
                </p>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-zinc-700"
            >
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this protein"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Protein"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
