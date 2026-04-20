"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { Protein, ProteinPage } from "@/types";

const SOURCE_LABELS: Record<string, string> = {
  pdb_id: "PDB",
  name: "UniProt",
  sequence: "Sequence",
  manual: "Manual",
};

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "pdb_id", label: "PDB" },
  { value: "name", label: "UniProt" },
  { value: "sequence", label: "Sequence" },
  { value: "manual", label: "Manual" },
];

const SORT_OPTIONS = [
  { value: "created_at_desc", label: "Newest first" },
  { value: "created_at_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

const PAGE_SIZE = 50;

function ProteinCard({ protein, labId }: { protein: Protein; labId: string }) {
  return (
    <Link
      href={`/dashboard/labs/${labId}/proteins/${protein.id}`}
      className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-400 hover:shadow-sm"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50 text-lg font-bold text-zinc-400">
        P
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-900 truncate">{protein.name}</p>
        {protein.display_name && protein.display_name !== protein.name && (
          <p className="mt-0.5 text-sm text-zinc-500 truncate">
            {protein.display_name}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          {protein.pdb_id && <span>PDB: {protein.pdb_id}</span>}
          {protein.uniprot_id && <span>UniProt: {protein.uniprot_id}</span>}
          <span>{SOURCE_LABELS[protein.source] ?? protein.source}</span>
          <span>{new Date(protein.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <span className="text-zinc-300">&rarr;</span>
    </Link>
  );
}

export default function ProteinsPage() {
  const { labId } = useParams<{ labId: string }>();

  const [data, setData] = useState<ProteinPage | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("created_at_desc");
  const [offset, setOffset] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProteins = useCallback(
    (params: {
      name: string;
      source: string;
      sort: string;
      offset: number;
    }) => {
      setLoading(true);
      const qs = new URLSearchParams();
      if (params.name) qs.set("name", params.name);
      if (params.source) qs.set("source", params.source);
      qs.set("sort", params.sort);
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String(params.offset));
      api
        .get<ProteinPage>(
          `/api/v1/labs/${labId}/proteins/?${qs.toString()}`,
        )
        .then(setData)
        .finally(() => setLoading(false));
    },
    [labId],
  );

  useEffect(() => {
    fetchProteins({ name: "", source: "", sort: "created_at_desc", offset: 0 });
  }, [fetchProteins]);

  function handleNameChange(value: string) {
    setName(value);
    setOffset(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProteins({ name: value.trim(), source, sort, offset: 0 });
    }, 300);
  }

  function handleSourceChange(value: string) {
    setSource(value);
    setOffset(0);
    fetchProteins({ name: name.trim(), source: value, sort, offset: 0 });
  }

  function handleSortChange(value: string) {
    setSort(value);
    setOffset(0);
    fetchProteins({ name: name.trim(), source, sort: value, offset: 0 });
  }

  function handlePage(newOffset: number) {
    setOffset(newOffset);
    fetchProteins({ name: name.trim(), source, sort, offset: newOffset });
  }

  const hasFilters = name || source;
  const total = data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/labs/${labId}`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            &larr; Lab dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            Proteins
          </h1>
        </div>
        <Link
          href={`/dashboard/labs/${labId}/proteins/new`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          New Protein
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Search by name"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Source
            </label>
            <select
              value={source}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Sort
            </label>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Count */}
      {data && !loading && (
        <p className="mt-4 text-sm text-zinc-500">
          {total} protein{total !== 1 ? "s" : ""}
          {hasFilters ? " matching filters" : ""}
        </p>
      )}

      {/* Results */}
      <div className="mt-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center">
            <p className="text-sm text-zinc-500">
              {hasFilters
                ? "No proteins match your filters."
                : "No proteins yet."}
            </p>
            {!hasFilters && (
              <Link
                href={`/dashboard/labs/${labId}/proteins/new`}
                className="mt-3 inline-block text-sm font-medium text-zinc-900 hover:underline"
              >
                Add the first protein
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((p) => (
              <ProteinCard key={p.id} protein={p} labId={labId} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => handlePage(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => handlePage(offset + PAGE_SIZE)}
            className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
