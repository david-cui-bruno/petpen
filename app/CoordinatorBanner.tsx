import Link from "next/link";
import { isCoordinator } from "@/lib/coordinator";
import { lockCoordinator } from "./coordinator/actions";

export async function CoordinatorBanner() {
  const ok = await isCoordinator();
  if (!ok) return null;

  return (
    <div className="bg-wood text-parchment text-center py-1 px-3 text-xl flex items-center justify-center gap-3 sticky top-0 z-40">
      <span>🔓 Coordinator mode</span>
      <Link href="/coordinator" className="underline text-base">
        dashboard
      </Link>
      <form action={lockCoordinator}>
        <button
          type="submit"
          className="text-base underline hover:no-underline"
        >
          lock
        </button>
      </form>
    </div>
  );
}
