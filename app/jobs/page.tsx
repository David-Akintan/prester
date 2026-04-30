"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { jobsApi, type JobRecord, type JobListParams } from "@/lib/api";
import { JobCard } from "@/app/jobs/JobCard";

const CATEGORIES = [
  "All",
  "Development",
  "Design",
  "Writing",
  "Marketing",
  "Data",
  "Video",
  "Other",
];
const STATUSES = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const LIMIT = 12;

  // Client-side filter over the currently loaded page. Matches against tags,
  // required_skills, and title (case-insensitive substring). Backend doesn't
  // expose a tag-search param yet, so this scopes to the visible page.
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const filteredJobs = useMemo(() => {
    if (!isSearching) return jobs;
    return jobs.filter((j) => {
      const tags = j.tags ?? [];
      const skills = j.required_skills ?? [];
      return (
        j.title.toLowerCase().includes(trimmedQuery) ||
        tags.some((t) => t.toLowerCase().includes(trimmedQuery)) ||
        skills.some((s) => s.toLowerCase().includes(trimmedQuery))
      );
    });
  }, [jobs, trimmedQuery, isSearching]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsAnimating(true);
    try {
      const params: JobListParams = { page, limit: LIMIT };
      if (selectedCategory && selectedCategory !== "All")
        params.category = selectedCategory;
      if (selectedStatus)
        params.status = selectedStatus as JobListParams["status"];
      const data = await jobsApi.list(params);

      // Tiny debounce so the cross-fade reads smoothly even when responses
      // return in a few ms.
      setTimeout(() => {
        setJobs(data.jobs);
        setTotal(data.total);
        setLoading(false);
        setIsAnimating(false);
      }, 150);
    } catch {
      setError("Failed to load jobs. Is the backend running?");
      setLoading(false);
      setIsAnimating(false);
    }
  }, [page, selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedStatus]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-10 animate-slideDown">
        <div className="inline-flex items-center gap-2 rounded-full border border-default bg-surface/70 backdrop-blur px-3 py-1 mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-foreground)]" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-muted">
            Marketplace
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-fg mb-3 animate-slideUp">
          Browse Opportunities
        </h1>
        <p className="text-sm sm:text-base text-muted animate-slideUp animation-delay-200 tabular-nums">
          {loading
            ? "Finding opportunities…"
            : isSearching
              ? `${filteredJobs.length} of ${jobs.length} on this page match "${searchQuery.trim()}"`
              : `${total} ${total === 1 ? "opportunity" : "opportunities"} available`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 animate-slideUp animation-delay-400">
        <div className="flex flex-col gap-4 sm:gap-5 rounded-2xl border border-default bg-surface/80 backdrop-blur-sm p-4 sm:p-5">
          {/* Search row */}
          <div className="relative">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by tag, skill, or title…"
              aria-label="Search jobs by tag, skill, or title"
              className="w-full rounded-full border border-default bg-surface pl-11 pr-10 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-foreground)] focus:ring-offset-2 transition-all hover:border-[var(--color-foreground)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-fg hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)]"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Status + Category row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-muted whitespace-nowrap pr-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
              </svg>
              Filter
            </div>
            {STATUSES.map((s, index) => (
              <button
                key={s.value}
                onClick={() => setSelectedStatus(s.value)}
                aria-pressed={selectedStatus === s.value}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 animate-scaleIn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2 ${
                  selectedStatus === s.value
                    ? "bg-[var(--color-foreground)] text-[var(--color-background)] shadow-sm"
                    : "border border-default text-muted hover:text-fg hover:border-[var(--color-foreground)]"
                }`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Category select */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-muted whitespace-nowrap">
              Category
            </span>
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-full border border-default bg-surface pl-4 pr-9 py-1.5 text-xs font-medium text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-foreground)] focus:ring-offset-2 cursor-pointer appearance-none transition-all hover:border-[var(--color-foreground)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c === "All" ? "" : c}>
                    {c}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-8 rounded-2xl border border-default bg-[var(--color-foreground)] text-[var(--color-background)] px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-default bg-surface/60 p-6 animate-pulse"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-5 bg-muted rounded w-16" />
              </div>
              <div className="mb-4 space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-4/6" />
              </div>
              <div className="mb-5 flex gap-2">
                <div className="h-6 bg-muted rounded-full w-16" />
                <div className="h-6 bg-muted rounded-full w-20" />
                <div className="h-6 bg-muted rounded-full w-14" />
              </div>
              <div className="border-t border-default pt-4 flex items-center justify-between">
                <div className="h-5 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job grid */}
      {!loading && filteredJobs.length > 0 && (
        <div
          className={`grid gap-5 sm:gap-6 grid-cols-1 lg:grid-cols-3 transition-all duration-300 ${
            isAnimating ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
          }`}
        >
          {filteredJobs.map((job, index) => (
            <div
              key={job.id}
              className="animate-fadeInUp"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <JobCard job={job} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — search-aware */}
      {!loading && filteredJobs.length === 0 && !error && (
        <div className="py-20 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl border border-default bg-[var(--color-foreground)] text-[var(--color-background)] flex items-center justify-center mb-6 shadow-sm">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isSearching ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A9.001 9.001 0 0012 3a9.001 9.001 0 00-9 9.255M12 21v-9m0 0l3 3m-3-3l-3 3"
                />
              )}
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-fg mb-2">
            {isSearching
              ? `No matches for "${searchQuery.trim()}"`
              : "No opportunities found"}
          </h3>
          <p className="text-sm text-muted mb-8 max-w-md mx-auto leading-relaxed">
            {isSearching
              ? "This search only scans the current page. Try clearing the search, switching pages, or adjusting filters."
              : "Try adjusting your filters, or be the first to post an opportunity and connect with talented freelancers."}
          </p>
          {isSearching ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-default bg-surface/70 backdrop-blur h-12 px-7 text-sm font-medium tracking-wide text-fg transition-all hover:border-[var(--color-foreground)] hover:-translate-y-0.5"
            >
              Clear search
            </button>
          ) : (
            <a
              href="/jobs/new"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-foreground)] text-[var(--color-background)] h-12 px-7 text-sm font-medium tracking-wide shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Post a Job
            </a>
          )}
        </div>
      )}

      {/* Pagination — hidden while a search filter is active to avoid lying
          about the number of pages of matches (search is page-scoped). */}
      {!isSearching && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 sm:gap-4 pt-12 sm:pt-14 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="group inline-flex items-center gap-1.5 rounded-full border border-default bg-surface/70 backdrop-blur h-10 px-3 sm:px-4 text-xs font-medium text-fg transition-all hover:border-[var(--color-foreground)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-default"
          >
            <svg
              className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 group-disabled:transform-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <PageNum n={1} active={page === 1} onClick={() => setPage(1)} />
            {page > 3 && <span className="text-muted px-0.5 sm:px-1">…</span>}
            {page > 2 && page < totalPages - 1 && (
              <PageNum n={page} active onClick={() => setPage(page)} />
            )}
            {page < totalPages - 2 && <span className="text-muted px-0.5 sm:px-1">…</span>}
            {totalPages > 1 && (
              <PageNum
                n={totalPages}
                active={page === totalPages}
                onClick={() => setPage(totalPages)}
              />
            )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="group inline-flex items-center gap-1.5 rounded-full border border-default bg-surface/70 backdrop-blur h-10 px-3 sm:px-4 text-xs font-medium text-fg transition-all hover:border-[var(--color-foreground)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-default"
          >
            <span className="hidden sm:inline">Next</span>
            <svg
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-disabled:transform-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function PageNum({
  n,
  active,
  onClick,
}: {
  n: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`h-9 min-w-9 px-2.5 rounded-full text-xs font-medium tabular-nums transition-all ${
        active
          ? "bg-[var(--color-foreground)] text-[var(--color-background)] shadow-sm"
          : "border border-default text-muted hover:text-fg hover:border-[var(--color-foreground)]"
      }`}
    >
      {n}
    </button>
  );
}
