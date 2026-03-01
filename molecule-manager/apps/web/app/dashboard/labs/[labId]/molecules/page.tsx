"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Molecule, SimilarityHit } from "@/types";

// ─── SVG thumbnail ────────────────────────────────────────────────────────────

function SvgThumb({ svg }: { svg: string }) {
  return (
    <div
      className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-white [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function NoStructure() {
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
      no SVG
    </div>
  );
}

// ─── Molecule cards ────────────────────────────────────────────────────────────

function MoleculeCard({ mol, labId }: { mol: Molecule; labId: string }) {
  return (
    <Link
      href={`/dashboard/labs/${labId}/molecules/${mol.id}`}
      className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-400 hover:shadow-sm"
    >
      {mol.svg_image ? <SvgThumb svg={mol.svg_image} /> : <NoStructure />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-900 truncate">{mol.name}</p>
        <p className="mt-0.5 font-mono text-sm text-zinc-500">
          {mol.molecular_formula ?? "—"}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          {mol.molecular_weight !== null && (
            <span>MW {mol.molecular_weight.toFixed(2)} g/mol</span>
          )}
          <span>{mol.method_used}</span>
          <span>{mol.date_created}</span>
        </div>
      </div>
      <span className="text-zinc-300">→</span>
    </Link>
  );
}

function SimilarityCard({
  hit,
  labId,
}: {
  hit: SimilarityHit;
  labId: string;
}) {
  const pct = (hit.similarity * 100).toFixed(1);
  // colour the badge by similarity tier
  const badgeClass =
    hit.similarity >= 0.9
      ? "bg-emerald-100 text-emerald-700"
      : hit.similarity >= 0.7
        ? "bg-blue-100 text-blue-700"
        : "bg-zinc-100 text-zinc-600";

  return (
    <Link
      href={`/dashboard/labs/${labId}/molecules/${hit.id}`}
      className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-400 hover:shadow-sm"
    >
      {hit.svg_image ? <SvgThumb svg={hit.svg_image} /> : <NoStructure />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-zinc-900 truncate">{hit.name}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
          >
            {pct}%
          </span>
        </div>
        <p className="mt-0.5 font-mono text-sm text-zinc-500">
          {hit.molecular_formula ?? "—"}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          {hit.molecular_weight !== null && (
            <span>MW {hit.molecular_weight.toFixed(2)} g/mol</span>
          )}
          <span>{hit.method_used}</span>
          <span>{hit.date_created}</span>
        </div>
      </div>
      <span className="text-zinc-300">→</span>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchMode = "text" | "substructure" | "similarity";

export default function MoleculesPage() {
  const { labId } = useParams<{ labId: string }>();

  const [molecules, setMolecules] = useState<Molecule[] | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("text");

  // ── text search state ──────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [method, setMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── substructure search state ──────────────────────────────────────────────
  const [substructureQuery, setSubstructureQuery] = useState("");
  const [substructureError, setSubstructureError] = useState("");
  const [substructureSearching, setSubstructureSearching] = useState(false);
  const [substructureResults, setSubstructureResults] = useState<
    Molecule[] | null
  >(null);

  // ── similarity search state ────────────────────────────────────────────────
  const [similarityQuery, setSimilarityQuery] = useState("");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [similarityError, setSimilarityError] = useState("");
  const [similaritySearching, setSimilaritySearching] = useState(false);
  const [similarityResults, setSimilarityResults] = useState<
    SimilarityHit[] | null
  >(null);

  // ── Text search helpers ────────────────────────────────────────────────────

  function buildUrl(filters: {
    name: string;
    method: string;
    dateFrom: string;
    dateTo: string;
  }) {
    const p = new URLSearchParams();
    if (filters.name) p.set("name", filters.name);
    if (filters.method) p.set("method", filters.method);
    if (filters.dateFrom) p.set("date_from", filters.dateFrom);
    if (filters.dateTo) p.set("date_to", filters.dateTo);
    const qs = p.toString();
    return `/api/v1/labs/${labId}/molecules/${qs ? `?${qs}` : ""}`;
  }

  function fetchMolecules(filters = { name, method, dateFrom, dateTo }) {
    setMolecules(null);
    api.get<Molecule[]>(buildUrl(filters)).then(setMolecules);
  }

  useEffect(() => {
    fetchMolecules({ name: "", method: "", dateFrom: "", dateTo: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchMolecules();
  }

  function handleReset() {
    setName("");
    setMethod("");
    setDateFrom("");
    setDateTo("");
    fetchMolecules({ name: "", method: "", dateFrom: "", dateTo: "" });
  }

  const hasFilters = name || method || dateFrom || dateTo;

  // ── Substructure search helpers ────────────────────────────────────────────

  async function handleSubstructureSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = substructureQuery.trim();
    if (!query) return;
    setSubstructureError("");
    setSubstructureResults(null);
    setSubstructureSearching(true);
    try {
      const results = await api.post<Molecule[]>(
        `/api/v1/labs/${labId}/molecules/substructure-search`,
        { smiles: query },
      );
      setSubstructureResults(results);
    } catch (err) {
      setSubstructureError(
        err instanceof ApiError
          ? err.message
          : "Search failed. Please try again.",
      );
    } finally {
      setSubstructureSearching(false);
    }
  }

  // ── Similarity search helpers ──────────────────────────────────────────────

  async function handleSimilaritySearch(e: React.FormEvent) {
    e.preventDefault();
    const query = similarityQuery.trim();
    if (!query) return;
    setSimilarityError("");
    setSimilarityResults(null);
    setSimilaritySearching(true);
    try {
      const results = await api.post<SimilarityHit[]>(
        `/api/v1/labs/${labId}/molecules/similarity-search`,
        { query_smiles: query, threshold: similarityThreshold },
      );
      setSimilarityResults(results);
    } catch (err) {
      setSimilarityError(
        err instanceof ApiError
          ? err.message
          : "Search failed. Please try again.",
      );
    } finally {
      setSimilaritySearching(false);
    }
  }

  // ── Mode toggle ───────────────────────────────────────────────────────────

  function switchMode(mode: SearchMode) {
    if (mode === searchMode) return;
    setSearchMode(mode);
    setName(""); setMethod(""); setDateFrom(""); setDateTo("");
    setSubstructureQuery(""); setSubstructureError(""); setSubstructureResults(null);
    setSimilarityQuery(""); setSimilarityError(""); setSimilarityResults(null);
    if (mode === "text") {
      fetchMolecules({ name: "", method: "", dateFrom: "", dateTo: "" });
    } else {
      setMolecules(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/labs/${labId}`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            ← Lab dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            Molecules
          </h1>
        </div>
        <Link
          href={`/dashboard/labs/${labId}/molecules/new`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Add molecule
        </Link>
      </div>

      {/* Mode toggle */}
      <div className="mt-6 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 w-fit">
        {(
          [
            ["text", "Text Search"],
            ["substructure", "Substructure"],
            ["similarity", "Similarity"],
          ] as [SearchMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => switchMode(mode)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              searchMode === mode
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Text search panel ─────────────────────────────────────────────── */}
      {searchMode === "text" && (
        <form
          onSubmit={handleSearch}
          className="mt-4 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Search by name"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">
                Method
              </label>
              <input
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="Search by method"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">
                Date from
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">
                Date to
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Search
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Clear filters
              </button>
            )}
          </div>
        </form>
      )}

      {/* ── Substructure search panel ──────────────────────────────────────── */}
      {searchMode === "substructure" && (
        <form
          onSubmit={handleSubstructureSearch}
          className="mt-4 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <label className="block text-xs font-medium text-zinc-500">
            Query SMILES
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={substructureQuery}
              onChange={(e) => setSubstructureQuery(e.target.value)}
              placeholder="e.g. c1ccccc1"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <button
              type="submit"
              disabled={substructureSearching || !substructureQuery.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {substructureSearching ? "Searching…" : "Search"}
            </button>
          </div>
          {substructureError && (
            <p className="mt-2 text-xs text-red-600">{substructureError}</p>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            Find all molecules that contain this fragment as a substructure.
          </p>
        </form>
      )}

      {/* ── Similarity search panel ────────────────────────────────────────── */}
      {searchMode === "similarity" && (
        <form
          onSubmit={handleSimilaritySearch}
          className="mt-4 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div>
              <label className="block text-xs font-medium text-zinc-500">
                Query SMILES
              </label>
              <input
                value={similarityQuery}
                onChange={(e) => setSimilarityQuery(e.target.value)}
                placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">
                Threshold —{" "}
                <span className="font-semibold text-zinc-700">
                  {(similarityThreshold * 100).toFixed(0)}%
                </span>
              </label>
              <input
                type="range"
                min={0.5}
                max={1.0}
                step={0.05}
                value={similarityThreshold}
                onChange={(e) =>
                  setSimilarityThreshold(parseFloat(e.target.value))
                }
                className="mt-2 w-full accent-zinc-900"
              />
              <div className="flex justify-between text-xs text-zinc-400">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={similaritySearching || !similarityQuery.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {similaritySearching ? "Searching…" : "Search"}
            </button>
            <p className="text-xs text-zinc-400">
              Returns molecules with Tanimoto ≥ threshold, sorted by
              similarity.
            </p>
          </div>
          {similarityError && (
            <p className="mt-2 text-xs text-red-600">{similarityError}</p>
          )}
        </form>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <div className="mt-6">
        {searchMode === "similarity" ? (
          similarityResults === null ? (
            similaritySearching ? (
              <div className="flex justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
                <p className="text-sm text-zinc-400">
                  Enter a SMILES and click Search.
                </p>
              </div>
            )
          ) : similarityResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
              <p className="text-sm text-zinc-500">
                No molecules above {(similarityThreshold * 100).toFixed(0)}%
                similarity.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {similarityResults.map((hit) => (
                <SimilarityCard key={hit.id} hit={hit} labId={labId} />
              ))}
            </div>
          )
        ) : searchMode === "substructure" ? (
          substructureResults === null ? (
            substructureSearching ? (
              <div className="flex justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
                <p className="text-sm text-zinc-400">
                  Enter a SMILES fragment above and click Search.
                </p>
              </div>
            )
          ) : substructureResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
              <p className="text-sm text-zinc-500">No matches found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {substructureResults.map((mol) => (
                <MoleculeCard key={mol.id} mol={mol} labId={labId} />
              ))}
            </div>
          )
        ) : molecules === null ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : molecules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
            <p className="text-sm text-zinc-500">
              {hasFilters
                ? "No molecules match your filters."
                : "No molecules yet."}
            </p>
            {!hasFilters && (
              <Link
                href={`/dashboard/labs/${labId}/molecules/new`}
                className="mt-3 inline-block text-sm font-medium text-zinc-900 hover:underline"
              >
                Add the first molecule
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {molecules.map((mol) => (
              <MoleculeCard key={mol.id} mol={mol} labId={labId} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
