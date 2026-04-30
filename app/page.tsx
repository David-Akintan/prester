"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { jobsApi } from "@/lib/api";
import { fetchJobCountAcrossChains } from "@/lib/contracts";
import { Reveal } from "@/app/components/ui/Reveal";

// "Jobs Posted" is summed from the FreelanceEscrow contract's `jobCount` on
// every configured chain — the chain is the source of truth. DB rows can be
// deleted; on-chain jobCount cannot. Active/Completed still come from the
// indexer because the contract doesn't expose status counters; if every
// chain read fails we fall back to the DB total so the hero never reads zero.

function useLiveStats() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetch() {
      try {
        const [chainAgg, dbAll, dbCompleted] = await Promise.all([
          fetchJobCountAcrossChains().catch(() => null),
          jobsApi.list({ limit: 1 }),
          jobsApi.list({ status: "completed", limit: 1 }),
        ]);
        const everyChainFailed =
          chainAgg != null &&
          chainAgg.failedChains.length > 0 &&
          Object.keys(chainAgg.perChain).length === 0;
        const total =
          chainAgg && !everyChainFailed ? Number(chainAgg.total) : dbAll.total;
        const completedJobs = Math.min(dbCompleted.total, total);
        setStats({
          totalJobs: total,
          activeJobs: Math.max(0, total - completedJobs),
          completedJobs,
          loading: false,
        });
      } catch {
        setStats((s) => ({ ...s, loading: false }));
      }
    }
    fetch();
  }, []);

  return stats;
}

const numberFormatter = new Intl.NumberFormat("en-US");

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Post Opportunity",
    body: "Describe the work, set milestones, and lock total payment into escrow upfront.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Work Gets Done",
    body: "Accept a bid, talent delivers milestone by milestone. You approve each one to release payment.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    step: "03",
    title: "AI Resolves Disputes",
    body: "If there's disagreement, a panel of independent AI judges reviews both sides and issues a binding, on-chain verdict.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
        />
      </svg>
    ),
  },
];

const TECH_STACK = [
  { label: "Celo", sub: "EVM" },
  { label: "Initia", sub: "Rollup" },
  { label: "IPFS", sub: "Storage" },
  { label: "Multi-Judge AI", sub: "Verdicts" },
];

export default function Home() {
  const stats = useLiveStats();

  return (
    <div className="animate-fadeIn">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-10 pb-16 sm:pt-14 sm:pb-20 md:pt-20 md:pb-28 text-center animate-slideDown">
        {/* Live status pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-default bg-surface/70 backdrop-blur px-3 py-1 mb-7 sm:mb-8 max-w-[calc(100%-2rem)]">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-foreground)] opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-foreground)]" />
          </span>
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-muted truncate">
            <span className="hidden sm:inline">
              Live on Celo · Base Network soon
            </span>
            <span className="sm:hidden">Live on Celo</span>
          </span>
        </div>

        <h1 className="text-[2.5rem] leading-[1.05] sm:text-6xl lg:text-7xl font-semibold tracking-tight text-fg mb-5 sm:mb-6 animate-slideUp px-2">
          Hire talent.
          <br />
          <span className="italic font-light">Pay with confidence.</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-muted max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed animate-slideUp animation-delay-200 px-2">
          Post opportunities, lock payment in escrow, and let a panel of AI
          judges settle disputes on-chain. No middlemen. No chargebacks. No
          excuses.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 animate-slideUp animation-delay-400 px-4 sm:px-0">
          <Link
            href="/jobs"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-foreground)] text-[var(--color-background)] h-12 px-6 sm:px-7 text-sm font-medium tracking-wide shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
          >
            Browse Jobs
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
          <Link
            href="/jobs/new"
            className="group inline-flex items-center justify-center gap-2 rounded-full border border-default bg-surface/70 backdrop-blur h-12 px-6 sm:px-7 text-sm font-medium tracking-wide text-fg transition-all hover:border-[var(--color-foreground)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
          >
            Post a Job
          </Link>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section className="mb-20 md:mb-28">
        <Reveal>
          <div className="flex flex-col items-center text-center mb-12 sm:mb-14">
            {/* Eyebrow pill — matches landing hero pill style */}
            <div className="inline-flex items-center gap-2 rounded-full border border-default bg-surface/70 backdrop-blur px-3 py-1 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-foreground)]" />
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-fg">
                Protocol
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-fg leading-[1.05] mb-4 px-2">
              How It Works
            </h2>
            <p className="text-base sm:text-lg text-muted max-w-xl leading-relaxed px-2">
              Three steps from posted opportunity to paid milestone — with
              on-chain dispute resolution if anything goes sideways.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {HOW_IT_WORKS.map((item, i) => (
            <Reveal key={item.step} delay={i * 120}>
              <div className="group relative h-full">
                <div className="relative h-full rounded-2xl border border-default bg-surface/80 backdrop-blur-sm p-7 transition-all duration-300 hover:border-[var(--color-foreground)] hover:shadow-xl hover:-translate-y-1">
                  {/* Top row: icon + step */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-default bg-[var(--color-foreground)] text-[var(--color-background)] transition-transform group-hover:scale-105">
                      {item.icon}
                    </div>
                    <span className="font-mono text-xs uppercase tracking-widest text-muted">
                      {item.step}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold tracking-tight text-fg mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {item.body}
                  </p>

                  {/* Bottom accent bar — animates in on hover */}
                  <span className="absolute bottom-0 left-7 right-7 h-px bg-[var(--color-foreground)] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Stats slab ────────────────────────────────────────────── */}
      <Reveal>
        <section className="relative overflow-hidden rounded-2xl border border-default bg-[var(--color-foreground)] text-[var(--color-background)] px-4 sm:px-10 py-8 sm:py-14">
          {/* Subtle inner highlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />

          <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-background)] opacity-60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-background)]" />
            </span>
            <p className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-[var(--color-background)]">
              Network Activity
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-8 divide-x divide-[color:var(--color-background)]/10">
            {[
              {
                value: stats.totalJobs,
                label: "Jobs Posted",
                labelShort: "Posted",
              },
              {
                value: stats.activeJobs,
                label: "Active",
                labelShort: "Active",
              },
              {
                value: stats.completedJobs,
                label: "Completed",
                labelShort: "Done",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="px-1 sm:px-4 first:pl-0 last:pr-0 text-center min-w-0"
              >
                <div className="font-mono text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tight tabular-nums truncate">
                  {stats.loading ? (
                    <span className="opacity-30">—</span>
                  ) : (
                    numberFormatter.format(stat.value)
                  )}
                </div>
                <div className="mt-1.5 sm:mt-2 text-[9px] sm:text-xs uppercase tracking-widest opacity-75 truncate">
                  <span className="hidden sm:inline">{stat.label}</span>
                  <span className="sm:hidden">{stat.labelShort}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── Tech / Trust strip ────────────────────────────── */}
      <Reveal delay={150}>
        <section className="mt-12 mb-12">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted text-center mb-6">
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {TECH_STACK.map((t) => (
              <div
                key={t.label}
                className="inline-flex items-center gap-2 rounded-full border border-default bg-surface/60 backdrop-blur px-4 py-2 transition-colors hover:border-[var(--color-foreground)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-foreground)]" />
                <span className="text-xs font-medium text-fg">{t.label}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  {t.sub}
                </span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
