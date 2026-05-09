import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="bg-wood-dark text-parchment px-4 py-2 flex flex-wrap items-center gap-4 border-b-4 border-wood">
      <Link
        href="/"
        className="font-pixel text-xs hover:text-grass-light"
        aria-label="petpen home"
      >
        🐾 petpen
      </Link>
      <div className="flex-1" />
      <Link href="/" className="text-xl hover:text-grass-light">
        Pen
      </Link>
      <Link href="/catalog" className="text-xl hover:text-grass-light">
        Catalog
      </Link>
      <Link href="/intake" className="text-xl hover:text-grass-light">
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
