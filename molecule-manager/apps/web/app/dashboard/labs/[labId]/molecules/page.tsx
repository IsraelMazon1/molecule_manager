"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Molecule } from "@/types";

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MoleculesPage() {
  const { labId } = useParams<{ labId: string }>();

  const [molecules, setMolecules] = useState<Molecule[] | null>(null);

  // filter state
  const [name, setName] = useState("");
  const [method, setMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  // initial load
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

      {/* Search / filters */}
      <form
        onSubmit={handleSearch}
        className="mt-6 rounded-xl border border-zinc-200 bg-white p-4"
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

      {/* Results */}
      <div className="mt-6">
        {molecules === null ? (
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
              <Link
                key={mol.id}
                href={`/dashboard/labs/${labId}/molecules/${mol.id}`}
                className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-400 hover:shadow-sm"
              >
                {mol.svg_image ? (
                  <SvgThumb svg={mol.svg_image} />
                ) : (
                  <NoStructure />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 truncate">
                    {mol.name}
                  </p>
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
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
