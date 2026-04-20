"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { SpreadsheetImportResult, SpreadsheetPreview } from "@/types";

// The fields we can map to
const SCHEMA_FIELDS = [
  { key: "smiles", label: "SMILES", required: true },
  { key: "name", label: "Name", required: false },
  { key: "method_used", label: "Method used", required: false },
  { key: "date_created", label: "Date created", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

type Step = "upload" | "mapping" | "result";

export default function ImportSpreadsheetPage() {
  const { labId } = useParams<{ labId: string }>();

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [preview, setPreview] = useState<SpreadsheetPreview | null>(null);

  // Step 2
  const [mapping, setMapping] = useState<Record<string, string | null>>({});

  // Step 3
  const [result, setResult] = useState<SpreadsheetImportResult | null>(null);

  // ── Step 1: Upload ─────────────────────────────────────────────────────────

  async function handleFileUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds the 5 MB size limit.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await api.postFile<SpreadsheetPreview>(
        `/api/v1/labs/${labId}/molecules/import/preview`,
        file,
      );
      setPreview(data);
      setMapping({ ...data.suggested_mapping });
      setStep("mapping");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to parse file.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Mapping ────────────────────────────────────────────────────────

  function updateMapping(field: string, column: string | null) {
    setMapping((prev) => ({ ...prev, [field]: column }));
  }

  function getMappedValue(
    row: Record<string, unknown>,
    field: string,
  ): string {
    const col = mapping[field];
    if (!col) return "";
    const val = row[col];
    return val != null ? String(val) : "";
  }

  const smilesIsMapped = !!mapping.smiles;

  async function handleCommit() {
    if (!preview || !smilesIsMapped) return;
    setError("");
    setLoading(true);
    try {
      const data = await api.post<SpreadsheetImportResult>(
        `/api/v1/labs/${labId}/molecules/import/commit`,
        { rows: preview.rows, mapping },
      );
      setResult(data);
      setStep("result");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Import failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/dashboard/labs/${labId}/molecules`}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          &larr; Molecules
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Import from Spreadsheet
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Step 1: File upload ───────────────────────────────────────── */}
      {step === "upload" && (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 p-16 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50">
          <span className="text-sm font-medium text-zinc-700">
            {loading
              ? "Parsing file..."
              : "Click to select an Excel or CSV file"}
          </span>
          <span className="text-xs text-zinc-400">
            Supports .xlsx, .xls, and .csv (max 5 MB, 1000 rows)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
            disabled={loading}
          />
          {loading && (
            <div className="mt-2 h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
          )}
        </label>
      )}

      {/* ── Step 2: Mapping review ────────────────────────────────────── */}
      {step === "mapping" && preview && (
        <div className="space-y-6">
          {/* Mapping table */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">
              Column mapping
            </h2>
            <p className="text-xs text-zinc-400 mb-4">
              We detected {preview.columns.length} columns and pre-filled the
              mapping. Adjust if needed.
            </p>
            <div className="space-y-3">
              {SCHEMA_FIELDS.map(({ key, label, required }) => (
                <div
                  key={key}
                  className="flex items-center gap-4"
                >
                  <span className="w-36 text-sm text-zinc-700 shrink-0">
                    {label}
                    {required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </span>
                  <select
                    value={mapping[key] ?? ""}
                    onChange={(e) =>
                      updateMapping(
                        key,
                        e.target.value === "" ? null : e.target.value,
                      )
                    }
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
                      required && !mapping[key]
                        ? "border-red-300 text-red-600"
                        : "border-zinc-300 text-zinc-900"
                    } focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500`}
                  >
                    <option value="">
                      {required ? "Select a column (required)" : "-- Not mapped --"}
                    </option>
                    {preview.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data preview */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Preview (first 5 rows of {preview.total_rows})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="px-3 py-2 text-left font-medium text-zinc-500">
                      #
                    </th>
                    {SCHEMA_FIELDS.map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-3 py-2 text-left font-medium text-zinc-500"
                      >
                        {label}
                        {!mapping[key] && (
                          <span className="ml-1 text-zinc-300">--</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                      {SCHEMA_FIELDS.map(({ key }) => (
                        <td
                          key={key}
                          className="px-3 py-2 text-zinc-900 max-w-[200px] truncate"
                        >
                          {getMappedValue(row, key) || (
                            <span className="text-zinc-300">--</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCommit}
              disabled={!smilesIsMapped || loading}
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {loading
                ? "Importing..."
                : `Import ${preview.total_rows} molecule${preview.total_rows !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={() => {
                setStep("upload");
                setPreview(null);
                setMapping({});
                setError("");
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Pick different file
            </button>
            {!smilesIsMapped && (
              <p className="text-xs text-red-600">
                SMILES column must be mapped before importing.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Result ────────────────────────────────────────────── */}
      {step === "result" && result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <h2 className="text-lg font-semibold text-green-800">
              Import complete
            </h2>
            <p className="mt-1 text-sm text-green-700">
              Successfully imported{" "}
              <strong>{result.imported}</strong> molecule
              {result.imported !== 1 ? "s" : ""}.
              {result.failed.length > 0 && (
                <span className="text-amber-700">
                  {" "}
                  {result.failed.length} row
                  {result.failed.length !== 1 ? "s" : ""} failed.
                </span>
              )}
            </p>
          </div>

          {result.failed.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-3">
                Failed rows
              </h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <div
                    key={i}
                    className="flex gap-3 text-sm text-amber-900"
                  >
                    <span className="shrink-0 font-medium">
                      Row {f.row}:
                    </span>
                    <span>{f.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/dashboard/labs/${labId}/molecules`}
            className="inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to molecules
          </Link>
        </div>
      )}
    </main>
  );
}
