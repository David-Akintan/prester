import Link from "next/link";
import { formatEth, cn } from "@/lib/utils";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import type { JobRecord } from "@/lib/api";

interface JobCardProps {
  job: JobRecord;
  className?: string;
}

export function JobCard({ job, className }: JobCardProps) {
  const totalEth = formatEth(BigInt(job.total_amount_wei));
  const postedAt = new Date(job.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/jobs/${job.id}`}>
      <article
        className={cn(
          "group border border-neutral-200 bg-white p-6 transition-all duration-300 animate-fadeInUp rounded-lg",
          "hover:border-black hover:shadow-xl hover:-translate-y-1",
          "focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2",
          className,
        )}
      >
        {/* Top row */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-black group-hover:text-black line-clamp-2 transition-colors animate-slideUp flex-1 pr-2">
            {job.title}
          </h3>
          <div className="animate-scaleIn animation-delay-200 shrink-0">
            <StatusBadge status={job.status} className="shrink-0" />
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-neutral-500 line-clamp-3 leading-relaxed animate-slideUp animation-delay-300">
          {job.description}
        </p>

        {/* Tags */}
        {job.required_skills?.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2 animate-slideUp animation-delay-400">
            {job.required_skills.slice(0, 3).map((skill, index) => (
              <span
                key={skill}
                className="border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600 uppercase tracking-wide animate-scaleIn hover:border-black hover:bg-black hover:text-white transition-all"
                style={{ animationDelay: `${400 + index * 100}ms` }}
              >
                {skill}
              </span>
            ))}
            {job.required_skills.length > 3 && (
              <span className="border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-400 uppercase tracking-wide animate-scaleIn">
                +{job.required_skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 animate-slideUp animation-delay-500">
          {/* Payment and stats row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Payment */}
              <div className="flex items-center gap-1.5 group/payment">
                <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest group-hover/payment:text-black transition-colors">
                  Total
                </span>
                <span className="text-lg font-bold text-black group-hover/payment:scale-105 transition-transform">
                  {totalEth} ETH
                </span>
              </div>

              <div className="h-4 w-px bg-neutral-200" />

              {/* Milestone count */}
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
                  {job.milestones?.length ?? 0}
                </span>
                <span className="text-xs text-neutral-500">
                  milestone{job.milestones?.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Bid count */}
              {job.status === "open" && job.bids && (
                <>
                  <div className="h-4 w-px bg-neutral-200" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
                      {job.bids.length}
                    </span>
                    <span className="text-xs text-neutral-500">
                      bid{job.bids.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Duration and date row */}
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              {job.estimated_duration && (
                <span className="font-medium animate-pulse">
                  {job.estimated_duration}
                </span>
              )}
            </div>
            <span>{postedAt}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
