import Image from "next/image";

interface LogoLoaderProps {
  /** Override the small caption rendered under the logo. */
  message?: string;
  /**
   * When true (default) the loader covers the whole viewport. Set false to
   * render an in-flow loader, e.g. inside a Suspense boundary on a card.
   */
  fullScreen?: boolean;
}

/**
 * Branded loading indicator. Pulsing Prester icon plus an animated
 * three-dot trail. Reused by `app/loading.tsx` for route transitions and
 * available for any local Suspense boundary.
 */
export function LogoLoader({
  message = "Loading",
  fullScreen = true,
}: LogoLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg"
          : "flex flex-col items-center justify-center gap-6 py-16"
      }
    >
      <Image
        src="/logo-icon.png"
        alt=""
        aria-hidden="true"
        width={96}
        height={96}
        priority
        className="h-24 w-24 animate-pulse drop-shadow-md"
      />
      <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-muted">
        <span>{message}</span>
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}
