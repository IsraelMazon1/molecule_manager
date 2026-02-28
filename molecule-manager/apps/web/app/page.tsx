import Link from "next/link";

// Middleware redirects authenticated users to /dashboard before this renders,
// so this page is only ever shown to unauthenticated visitors.
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white text-xl">
          ⬡
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900">
          Molecule Manager
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage molecules and experiments with your research lab.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login"
            className="block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white text-center transition-colors hover:bg-zinc-700"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 text-center transition-colors hover:bg-zinc-50"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
