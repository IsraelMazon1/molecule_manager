"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Molecule } from "@/types";

// Shape returned by POST /api/v1/chemistry/validate
interface ChemPreview {
  canonical_smiles: string;
  molecular_weight: number;
  molecular_formula: string;
  hbd: number;
  hba: number;
  tpsa: number;
  rotatable_bonds: number;
  svg_image: string;
}

// Shape returned by GET /api/v1/chemistry/pubchem
interface PubChemResult {
  pubchem_cid: number;
  name: string;
  smiles: string;
  molecular_formula: string;
  molecular_weight: number;
  iupac_name: string;
}

// ─── Small display helpers ────────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-zinc-100 last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewMoleculePage() {
  const { labId } = useParams<{ labId: string }>();
  const router = useRouter();

  // form fields
  const [name, setName] = useState("");
  const [smiles, setSmiles] = useState("");
  const [dateCreated, setDateCreated] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [methodUsed, setMethodUsed] = useState("");
  const [notes, setNotes] = useState("");

  // SMILES validation state
  const [validating, setValidating] = useState(false);
  const [smilesError, setSmilesError] = useState("");
  const [preview, setPreview] = useState<ChemPreview | null>(null);

  // tracks CID when user selects a PubChem result (cleared if SMILES edited)
  const [selectedCid, setSelectedCid] = useState<number | null>(null);

  // form submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // PubChem search panel
  const [showPubchem, setShowPubchem] = useState(false);
  const [pubchemQuery, setPubchemQuery] = useState("");
  const [pubchemResults, setPubchemResults] = useState<PubChemResult[]>([]);
  const [pubchemLoading, setPubchemLoading] = useState(false);
  const [pubchemError, setPubchemError] = useState("");

  const smilesInputRef = useRef<HTMLInputElement>(null);

  // ── Live PubChem search (debounced) ───────────────────────────────────────

  useEffect(() => {
    const q = pubchemQuery.trim();
    if (!showPubchem || !q) {
      setPubchemResults([]);
      setPubchemError("");
      setPubchemLoading(false);
      return;
    }

    setPubchemLoading(true);
    setPubchemError("");

    const timer = setTimeout(async () => {
      try {
        const results = await api.get<PubChemResult[]>(
          `/api/v1/chemistry/pubchem?query=${encodeURIComponent(q)}`,
        );
        setPubchemResults(results);
        if (results.length === 0) {
          setPubchemError("No results found. Try a different name or CAS number.");
        }
      } catch {
        setPubchemError("Search failed. Please try again.");
      } finally {
        setPubchemLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [pubchemQuery, showPubchem]);

  // ── Validate SMILES ───────────────────────────────────────────────────────

  async function validateSmiles(raw: string) {
    const val = raw.trim();
    if (!val) {
      setPreview(null);
      setSmilesError("");
      return;
    }
    setValidating(true);
    setSmilesError("");
    setPreview(null);
    try {
      const result = await api.post<ChemPreview>("/api/v1/chemistry/validate", {
        smiles: val,
      });
      setPreview(result);
    } catch (err) {
      setSmilesError(
        err instanceof ApiError && err.isValidation
          ? "Invalid SMILES string — please check and try again."
          : "Could not validate SMILES. Please try again.",
      );
    } finally {
      setValidating(false);
    }
  }

  async function handleSmilesBlur() {
    await validateSmiles(smiles);
  }

  async function handleSelectResult(result: PubChemResult) {
    // Pre-fill name if currently empty
    if (!name.trim()) {
      setName(result.iupac_name || result.name);
    }
    setSmiles(result.smiles);
    setSelectedCid(result.pubchem_cid);
    setShowPubchem(false);
    setPubchemResults([]);
    setPubchemQuery("");
    // Trigger validation with the PubChem SMILES
    await validateSmiles(result.smiles);
    smilesInputRef.current?.focus();
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (smilesError) return;
    if (!preview) {
      setSubmitError("Please wait for SMILES validation before saving.");
      return;
    }

    setSubmitting(true);
    try {
      let mol: Molecule;

      if (selectedCid !== null) {
        // User selected a PubChem compound — use the import endpoint so the
        // backend fetches authoritative SMILES (CID is NOT stored permanently).
        mol = await api.post<Molecule>(
          `/api/v1/labs/${labId}/molecules/import-pubchem`,
          {
            pubchem_cid: selectedCid,
            name: name.trim(),
            method_used: methodUsed.trim(),
            date_created: dateCreated,
            notes: notes.trim() || null,
          },
        );
      } else {
        mol = await api.post<Molecule>(`/api/v1/labs/${labId}/molecules/`, {
          name: name.trim(),
          smiles: smiles.trim(),
          date_created: dateCreated,
          method_used: methodUsed.trim(),
          notes: notes.trim() || null,
        });
      }

      router.push(`/dashboard/labs/${labId}/molecules/${mol.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/dashboard/labs/${labId}/molecules`}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ← Molecules
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Add molecule
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {submitError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {submitError}
          </p>
        )}

        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aspirin"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* SMILES + PubChem search */}
        <div>
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="smiles"
              className="block text-sm font-medium text-zinc-700"
            >
              SMILES <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setShowPubchem((v) => !v);
                setPubchemError("");
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {showPubchem ? "Close PubChem search" : "Search PubChem"}
            </button>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            Structure is validated and previewed when you leave this field
          </p>

          {/* PubChem search panel */}
          {showPubchem && (
            <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="mb-3 text-xs font-medium text-blue-700">
                Search by molecule name or CAS number
              </p>
              <div className="relative">
                <input
                  value={pubchemQuery}
                  onChange={(e) => setPubchemQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  placeholder="e.g. Aspirin, doxycycline, 50-78-2…"
                  autoFocus
                  className="block w-full rounded-lg border border-blue-300 bg-white px-3 py-2 pr-9 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {pubchemLoading && (
                  <span className="absolute right-3 top-2.5">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                  </span>
                )}
              </div>

              {pubchemError && (
                <p className="mt-2 text-xs text-red-600">{pubchemError}</p>
              )}

              {pubchemResults.length > 0 && (
                <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                  {pubchemResults.map((r) => (
                    <li key={r.pubchem_cid}>
                      <button
                        type="button"
                        onClick={() => handleSelectResult(r)}
                        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                      >
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {r.iupac_name || r.name || `CID ${r.pubchem_cid}`}
                        </p>
                        <p className="mt-0.5 flex gap-3 text-xs text-zinc-500">
                          <span className="font-mono">{r.molecular_formula}</span>
                          {r.molecular_weight > 0 && (
                            <span>{r.molecular_weight.toFixed(2)} g/mol</span>
                          )}
                          <span className="text-zinc-400">
                            CID {r.pubchem_cid}
                          </span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

            </div>
          )}

          <div className="relative mt-1">
            <input
              id="smiles"
              ref={smilesInputRef}
              required
              value={smiles}
              onChange={(e) => {
                setSmiles(e.target.value);
                setPreview(null);
                setSmilesError("");
                setSelectedCid(null); // user edited manually — clear PubChem CID
              }}
              onBlur={handleSmilesBlur}
              placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
              spellCheck={false}
              className={`block w-full rounded-lg border px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 ${
                smilesError
                  ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                  : preview
                    ? "border-green-400 focus:border-green-400 focus:ring-green-400"
                    : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-500"
              }`}
            />
            {validating && (
              <span className="absolute right-3 top-2.5">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 inline-block" />
              </span>
            )}
          </div>
          {smilesError && (
            <p className="mt-1.5 text-xs text-red-600">{smilesError}</p>
          )}
          {selectedCid !== null && (
            <p className="mt-1 text-xs text-blue-600">
              PubChem CID {selectedCid} selected
            </p>
          )}
        </div>

        {/* Chemistry preview panel */}
        {preview && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="mb-3 text-xs font-medium text-green-700">
              Structure validated ✓
            </p>
            <div className="flex gap-5">
              {/* SVG */}
              <div
                className="h-36 w-36 shrink-0 overflow-hidden rounded-lg border border-green-200 bg-white [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: preview.svg_image }}
              />
              {/* Properties */}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-semibold text-zinc-900">
                  {preview.molecular_formula}
                </p>
                <p className="mt-0.5 font-mono text-xs text-zinc-500 break-all">
                  {preview.canonical_smiles}
                </p>
                <div className="mt-3 space-y-0">
                  <PropRow
                    label="Mol. weight"
                    value={`${preview.molecular_weight.toFixed(3)} g/mol`}
                  />
                  <PropRow label="HBD" value={preview.hbd} />
                  <PropRow label="HBA" value={preview.hba} />
                  <PropRow
                    label="TPSA"
                    value={`${preview.tpsa.toFixed(2)} Å²`}
                  />
                  <PropRow
                    label="Rotatable bonds"
                    value={preview.rotatable_bonds}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date created */}
        <div>
          <label
            htmlFor="date_created"
            className="block text-sm font-medium text-zinc-700"
          >
            Date created <span className="text-red-500">*</span>
          </label>
          <input
            id="date_created"
            type="date"
            required
            value={dateCreated}
            onChange={(e) => setDateCreated(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Method used */}
        <div>
          <label
            htmlFor="method_used"
            className="block text-sm font-medium text-zinc-700"
          >
            Method used <span className="text-red-500">*</span>
          </label>
          <input
            id="method_used"
            required
            value={methodUsed}
            onChange={(e) => setMethodUsed(e.target.value)}
            placeholder="e.g. Synthesis, Commercial source"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Notes */}
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
            placeholder="Optional notes about this molecule"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !!smilesError || validating}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save molecule"}
        </button>
      </form>
    </main>
  );
}
