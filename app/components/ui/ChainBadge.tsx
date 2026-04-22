import { getChainMeta } from "@/lib/chains";
import { cn } from "@/lib/utils";

interface ChainBadgeProps {
  chainId: number | null | undefined;
  className?: string;
  size?: "sm" | "md";
}

export function ChainBadge({
  chainId,
  className,
  size = "sm",
}: ChainBadgeProps) {
  const meta = getChainMeta(chainId ?? undefined);

  const sizing =
    size === "md"
      ? "px-2.5 py-1 text-xs gap-2"
      : "px-2 py-0.5 text-[10px] gap-1.5";

  if (!meta) {
    return (
      <span
        title="Unknown chain"
        className={cn(
          "inline-flex items-center border border-gray-300 bg-gray-50 font-mono uppercase tracking-wide text-gray-400 rounded-md",
          sizing,
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        <span>—</span>
      </span>
    );
  }

  return (
    <span
      title={meta.name}
      className={cn(
        "inline-flex items-center border border-gray-300 bg-white font-mono uppercase tracking-wide text-gray-700 rounded-md",
        sizing,
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.accentColor }}
      />
      <span>{meta.shortName}</span>
      {meta.isTestnet && (
        <span className="text-[9px] text-gray-400">TESTNET</span>
      )}
    </span>
  );
}
