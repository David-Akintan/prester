import { LogoLoader } from "@/app/components/ui/LogoLoader";

/**
 * Root-segment loading UI. Next.js renders this automatically while server
 * components for the matched route are loading. It's also the Suspense
 * fallback for any client navigation that triggers data fetching.
 */
export default function Loading() {
  return <LogoLoader />;
}
