import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-default bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-widest">Prester</span>
          <span aria-hidden="true">·</span>
          <span>Decentralized escrow with AI-judge dispute resolution</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="https://github.com/David-Akintan/prester"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fg transition-colors focus-visible:outline-none focus-visible:underline"
          >
            GitHub
          </Link>
          <span aria-hidden="true">·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
