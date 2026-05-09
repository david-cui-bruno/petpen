import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="bg-wood-dark text-parchment px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-4 border-b-4 border-wood">
      <Link
        href="/"
        className="font-pixel text-[10px] sm:text-xs hover:text-grass-light shrink-0"
        aria-label="petpen home"
      >
        🐾 petpen
      </Link>
      <div className="flex-1" />
      <Link
        href="/"
        className="text-base sm:text-xl hover:text-grass-light"
      >
        Pen
      </Link>
      <Link
        href="/catalog"
        className="text-base sm:text-xl hover:text-grass-light"
      >
        Catalog
      </Link>
      <Link
        href="/intake"
        className="text-base sm:text-xl hover:text-grass-light"
      >
        Intake
      </Link>
      <Link
        href="/coordinator"
        className="text-xl hover:text-grass-light"
        title="Coordinator (PIN required)"
        aria-label="Coordinator"
      >
        🔒
      </Link>
    </nav>
  );
}
