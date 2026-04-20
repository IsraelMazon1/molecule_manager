"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LabMember } from "@/types";

export default function MembersPage() {
  const { labId } = useParams<{ labId: string }>();
  const { user } = useAuth();

  const [members, setMembers] = useState<LabMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "promote" | "demote" | "remove";
    member: LabMember;
  } | null>(null);

  const currentRole =
    members?.find((m) => m.user_id === user?.id)?.role ?? "STUDENT";
  const isPI = currentRole === "PI";

  function fetchMembers() {
    return api
      .get<LabMember[]>(`/api/v1/labs/${labId}/members`)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  async function executeAction() {
    if (!confirmAction) return;
    const { type, member } = confirmAction;
    setConfirmAction(null);
    setActionError("");
    setActionLoadingId(member.user_id);

    try {
      if (type === "promote") {
        await api.patch(
          `/api/v1/labs/${labId}/members/${member.user_id}/role`,
          { role: "PI" },
        );
      } else if (type === "demote") {
        await api.patch(
          `/api/v1/labs/${labId}/members/${member.user_id}/role`,
          { role: "STUDENT" },
        );
      } else if (type === "remove") {
        await api.delete(
          `/api/v1/labs/${labId}/members/${member.user_id}`,
        );
      }
      await fetchMembers();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Action failed.",
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  const actionLabels = {
    promote: "Promote to PI",
    demote: "Demote to Student",
    remove: "Remove from Lab",
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/dashboard/labs/${labId}`}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          &larr; Lab dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Members</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          {members?.length ?? 0} member{members?.length !== 1 ? "s" : ""}
        </p>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {actionError}
        </div>
      )}

      <div className="space-y-2">
        {members?.map((member) => {
          const isYou = member.user_id === user?.id;
          const isLoading = actionLoadingId === member.user_id;

          return (
            <div
              key={member.user_id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {member.email}
                    {isYou && (
                      <span className="ml-1.5 text-xs text-zinc-400">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Joined{" "}
                    {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    member.role === "PI"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {member.role === "PI" ? "PI" : "Student"}
                </span>
              </div>

              {isPI && !isYou && (
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() =>
                      setConfirmAction({ type: "promote", member })
                    }
                    disabled={member.role === "PI" || isLoading}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-amber-400 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Promote
                  </button>
                  <button
                    onClick={() =>
                      setConfirmAction({ type: "demote", member })
                    }
                    disabled={member.role === "STUDENT" || isLoading}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-blue-400 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Demote
                  </button>
                  <button
                    onClick={() =>
                      setConfirmAction({ type: "remove", member })
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              )}

              {isLoading && (
                <div className="ml-3 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              {actionLabels[confirmAction.type]}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              {confirmAction.type === "remove" ? (
                <>
                  Remove <strong>{confirmAction.member.email}</strong> from this
                  lab? Their molecules and experiments will remain in the lab.
                </>
              ) : confirmAction.type === "promote" ? (
                <>
                  Promote <strong>{confirmAction.member.email}</strong> to PI?
                  They will be able to manage members and access the audit log.
                </>
              ) : (
                <>
                  Demote <strong>{confirmAction.member.email}</strong> to
                  Student? They will lose PI privileges.
                </>
              )}
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  confirmAction.type === "remove"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-zinc-900 hover:bg-zinc-700"
                }`}
              >
                {actionLabels[confirmAction.type]}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
