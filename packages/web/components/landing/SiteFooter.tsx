import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-refined-100 px-8 py-8 lg:px-20">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-semibold text-refined-950">Receipts</span>
          <span className="text-refined-500">
            An honest record of how you wrote it.
          </span>
        </div>
        <nav className="flex items-center gap-6 text-refined-500">
          <Link href="/editor" className="hover:text-refined-950">
            Editor
          </Link>
          <Link href="/r/demo" className="hover:text-refined-950">
            Sample
          </Link>
          <Link href="#" className="hover:text-refined-950">
            GitHub
          </Link>
        </nav>
      </div>
    </footer>
  );
}
