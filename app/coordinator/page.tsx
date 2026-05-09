import Link from "next/link";
import { isCoordinator } from "@/lib/coordinator";
import { listCoordinatorRows } from "@/lib/queries";
import { unlockCoordinator } from "./actions";
import { CoordinatorTable } from "./CoordinatorTable";

export const metadata = { title: "Coordinator — petpen" };
export const dynamic = "force-dynamic";

export default async function CoordinatorPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const ok = await isCoordinator();

  if (!ok) {
    return (
      <main className="flex-1 max-w-md mx-auto p-6">
        <h1 className="font-pixel text-2xl text-wood-dark mb-4">
          Coordinator
        </h1>
        <form action={unlockCoordinator} className="panel-parchment p-4 space-y-3">
          <p className="text-xl">Enter the PIN to unlock coordinator tools.</p>
          <label className="block">
            <span className="text-xl">PIN</span>
            <input
              type="password"
              name="pin"
              autoComplete="off"
              required
              autoFocus
              className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark text-2xl tracking-widest"
            />
          </label>
          {sp.error === "bad_pin" && (
            <p className="text-base text-red-700">Wrong PIN. Try again.</p>
          )}
          <button
            type="submit"
            className="font-pixel text-xs bg-grass-dark text-parchment px-4 py-2 pixel-border w-full"
          >
            Unlock
          </button>
        </form>
        <p className="text-base mt-4 italic text-wood">
          Set <code>COORDINATOR_PIN</code> in <code>.env.local</code> if you
          haven&apos;t.
        </p>
        <p className="text-base mt-4">
          <Link href="/" className="underline">
            ← back to the pen
          </Link>
        </p>
      </main>
    );
  }

  const rows = await listCoordinatorRows(sp.status);

  return (
    <main className="flex-1 max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="font-pixel text-2xl text-wood-dark">
          Coordinator dashboard
        </h1>
      </header>
      <CoordinatorTable rows={rows} currentStatus={sp.status ?? "all"} />
    </main>
  );
}
