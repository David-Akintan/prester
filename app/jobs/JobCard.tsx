import Link from "next/link";
import { formatEth, cn } from "@/lib/utils";
import { getNativeSymbol } from "@/lib/chains";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { ChainBadge } from "@/app/components/ui/ChainBadge";
import type { JobRecord } from "@/lib/api";

interface JobCardProps {
  job: JobRecord;
  className?: string;
}

export function JobCard({ job, className }: JobCardProps) {
  const totalEth = formatEth(BigInt(job.total_amount_wei));
  const nativeSymbol = getNativeSymbol(job.chain_id);
  const postedAt = new Date(job.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/jobs/${job.id}`} className="job-card-link">
      <article
        className={cn(
          "group border border-default bg-surface/80 backdrop-blur-sm transition-all duration-300 animate-fade-in-up rounded-2xl h-full flex flex-col",
          "hover:border-[var(--color-foreground)] hover:shadow-xl hover:-translate-y-1",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-foreground)] focus:ring-offset-2",
          className,
        )}
      >
        {/* Card Content */}
        <div className="flex flex-col h-full p-5 sm:p-6">
          {/* Top row - Title and Status */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-fg line-clamp-2 transition-colors animate-slide-up flex-1 leading-tight min-w-0">
              {job.title}
            </h3>
            <div className="flex flex-col items-end gap-1.5 animate-scale-in animation-delay-200 shrink-0">
              <ChainBadge chainId={job.chain_id} />
              <StatusBadge status={job.status} className="shrink-0" />
              {job.visibility === "nda" && (
                <span
                  title="NDA — deliverables confidential to the assigned freelancer and client"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-background)]"
                >
                  🔒 NDA
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-4 min-h-[4rem]">
            <p className="text-sm text-muted line-clamp-3 leading-relaxed animate-slide-up animation-delay-300">
              {job.description}
            </p>
          </div>

          {/* Tags */}
          <div className="mb-4 min-h-[2rem] flex flex-wrap gap-1.5 animate-slide-up animation-delay-400">
            {job.required_skills?.length > 0 ? (
              <>
                {job.required_skills.slice(0, 3).map((skill, index) => (
                  <span
                    key={skill}
                    className="rounded-full border border-default bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted hover:border-[var(--color-foreground)] hover:text-fg transition-all animate-scale-in truncate max-w-[140px]"
                    style={{ animationDelay: `${400 + index * 100}ms` }}
                  >
                    {skill}
                  </span>
                ))}
                {job.required_skills.length > 3 && (
                  <span className="rounded-full border border-default bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted animate-scale-in">
                    +{job.required_skills.length - 3}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-muted">
                No specific skills required
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer */}
          <div className="flex flex-col gap-3 border-t border-default pt-4 animate-slide-up animation-delay-500">
            {/* Payment row — payment isolated and prominent on its own line */}
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[10px] font-mono text-muted uppercase tracking-widest shrink-0">
                Total
              </span>
              <span className="text-base sm:text-lg font-bold text-fg tabular-nums truncate">
                {totalEth} {nativeSymbol}
              </span>
            </div>

            {/* Stats chips — wrap freely on narrow widths */}
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="font-mono tabular-nums text-fg">
                  {job.milestones?.length ?? 0}
                </span>
                milestone{job.milestones?.length !== 1 ? "s" : ""}
              </span>
              {job.status === "open" && job.bids && (
                <>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-mono tabular-nums text-fg">
                      {job.bids.length}
                    </span>
                    bid{job.bids.length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
              {job.estimated_duration && (
                <>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <span className="font-medium truncate">
                    {job.estimated_duration}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="ml-auto whitespace-nowrap">{postedAt}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
