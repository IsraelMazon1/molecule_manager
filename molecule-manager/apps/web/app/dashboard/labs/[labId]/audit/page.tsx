"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AuditLog, AuditLogPage, LabDetail } from "@/types";

const PAGE_SIZE = 50;

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

const ENTITY_LABELS: Record<string, string> = {
  MOLECULE: "Molecule",
  EXPERIMENT: "Experiment",
  EXPERIMENT_MOLECULE: "Attachment",
  LAB_MEMBER: "Member",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditPage() {
  const { labId } = useParams<{ labId: string }>();
  const { user } = useAuth();

  const [lab, setLab] = useState<LabDetail | null>(null);
  const [page, setPage] = useState<AuditLogPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loadingLab, setLoadingLab] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  // Fetch lab detail first to determine role
  useEffect(() => {
    api
      .get<LabDetail>(`/api/v1/labs/${labId}`)
      .then(setLab)
      .catch(() => setForbidden(true))
      .finally(() => setLoadingLab(false));
  }, [labId]);

  // Fetch audit page whenever lab is ready and offset changes
  useEffect(() => {
    if (!lab) return;
    const isPI = lab.members.find((m) => m.user_id === user?.id)?.role === "PI";
    if (!isPI) return;

    setLoadingPage(true);
    api
      .get<AuditLogPage>(
        `/api/v1/labs/${labId}/audit?limit=${PAGE_SIZE}&offset=${offset}`,
      )
      .then(setPage)
      .catch(() => setForbidden(true))
      .finally(() => setLoadingPage(false));
  }, [lab, offset, labId, user?.id]);

  if (loadingLab) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  const currentUserRole =
    lab?.members.find((m) => m.user_id === user?.id)?.role ?? "STUDENT";

  if (forbidden || currentUserRole !== "PI") {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href={`/dashboard/labs/${labId}`}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ← Lab dashboard
        </Link>
        <p className="mt-4 text-sm text-zinc-500">
          Access denied. PI role required to view audit logs.
        </p>
      </main>
    );
  }

  // Build a quick email lookup from the members list
  const emailById: Record<string, string> = {};
  lab?.members.forEach((m) => {
    emailById[m.user_id] = m.email;
  });

  function userLabel(entry: AuditLog): string {
    if (!entry.user_id) return "deleted user";
    return emailById[entry.user_id] ?? entry.user_id;
  }

  const total = page?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/labs/${labId}`}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ← Lab dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Audit Log
        </h1>
        {page && (
          <p className="mt-0.5 text-sm text-zinc-400">
            {total} event{total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {loadingPage || page === null ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        ) : page.items.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-500">
            No audit events yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {page.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700">
                      {userLabel(entry)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          ACTION_STYLES[entry.action] ??
                          "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-zinc-900">
                      {entry.entity_name ?? "—"}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-xs text-zinc-500">
                      {entry.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {page && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Page {currentPage} of {totalPages} &middot; {total} total events
          </p>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-500 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-500 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
