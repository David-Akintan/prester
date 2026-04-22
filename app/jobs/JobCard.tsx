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
          "group border border-gray-300 bg-white transition-all duration-300 animate-fade-in-up rounded-xl h-full flex flex-col",
          "hover:border-black hover:shadow-xl hover:-translate-y-1",
          "focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2",
          className,
        )}
      >
        {/* Card Content */}
        <div className="flex flex-col h-full p-6">
          {/* Top row - Title and Status */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-black group-hover:text-black line-clamp-2 transition-colors animate-slide-up flex-1 pr-2 leading-tight">
              {job.title}
            </h3>
            <div className="flex flex-col items-end gap-1.5 animate-scale-in animation-delay-200 shrink-0">
              <ChainBadge chainId={job.chain_id} />
              <StatusBadge status={job.status} className="shrink-0" />
            </div>
          </div>

          {/* Description - Better height control */}
          <div className="mb-4 min-h-[4rem]">
            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed animate-slide-up animation-delay-300">
              {job.description}
            </p>
          </div>

          {/* Tags - Better height control */}
          <div className="mb-4 min-h-[2rem] flex flex-wrap gap-2 animate-slide-up animation-delay-400">
            {job.required_skills?.length > 0 ? (
              <>
                {job.required_skills.slice(0, 3).map((skill, index) => (
                  <span
                    key={skill}
                    className="border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 uppercase tracking-wide animate-scale-in hover:border-black hover:bg-black hover:text-white transition-all rounded-lg"
                    style={{ animationDelay: `${400 + index * 100}ms` }}
                  >
                    {skill}
                  </span>
                ))}
                {job.required_skills.length > 3 && (
                  <span className="border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide animate-scale-in rounded-lg">
                    +{job.required_skills.length - 3}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  No specific skills required
                </span>
              </div>
            )}
          </div>

          {/* Spacer to push footer to bottom */}
          <div className="flex-1" />

          {/* Footer - Always at bottom */}
          <div className="flex flex-col gap-3 border-t border-gray-300 pt-4 animate-slide-up animation-delay-500">
            {/* Payment and stats row - Better spacing */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Payment */}
                <div className="flex items-center gap-1.5 group/payment">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-wider group-hover/payment:text-black transition-colors">
                    Total
                  </span>
                  <span className="text-lg font-bold text-black group-hover/payment:scale-105 transition-transform">
                    {totalEth} {nativeSymbol}
                  </span>
                </div>

                <div className="h-4 w-px bg-gray-300" />

                {/* Milestone count */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                    {job.milestones?.length ?? 0}
                  </span>
                  <span className="text-xs text-gray-500">
                    milestone{job.milestones?.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Bid count */}
                {job.status === "open" && job.bids && (
                  <>
                    <div className="h-4 w-px bg-gray-300" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                        {job.bids.length}
                      </span>
                      <span className="text-xs text-gray-500">
                        bid{job.bids.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Duration and date row - Better spacing */}
            <div className="flex items-center justify-between text-xs text-gray-400 gap-4">
              <div className="flex items-center gap-2">
                {job.estimated_duration && (
                  <span className="font-medium">{job.estimated_duration}</span>
                )}
              </div>
              <span>{postedAt}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
