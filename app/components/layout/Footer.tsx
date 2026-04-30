import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-subtle bg-surface/60 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:gap-5 md:flex-row text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-foreground)] opacity-50 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-foreground)]" />
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-fg">
                Prester
              </span>
            </div>
            <span aria-hidden="true" className="hidden sm:inline text-muted">·</span>
            <span className="text-[11px] sm:text-xs text-muted leading-snug">
              Decentralized escrow with AI-judge dispute resolution
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted shrink-0">
            <Link
              href="https://github.com/David-Akintan/prester"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface/70 px-3 py-1 transition-all hover:text-fg hover:border-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.96 10.96 0 015.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
              </svg>
              GitHub
            </Link>
            <span aria-hidden="true" className="text-muted">·</span>
            <span className="font-mono tabular-nums">
              © {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
