"use client";

import { useState, useEffect, useCallback } from "react";
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
  { value: "", label: "All Jobs" },
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
  const [isAnimating, setIsAnimating] = useState(false);
  const LIMIT = 12;

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

      // Simulate animation delay for smooth transitions
      setTimeout(() => {
        setJobs(data.jobs);
        setTotal(data.total);
        setLoading(false);
        setIsAnimating(false);
      }, 300);
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
    <div className="min-h-screen bg-white animate-fadeIn">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 animate-slideDown">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest animate-pulse">
              Jobs
            </span>
            <span className="text-neutral-300 animate-pulse">/</span>
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest animate-pulse">
              Opportunities
            </span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-black mb-4 animate-slideUp">
            Browse Opportunities
          </h1>
          <p className="text-lg text-neutral-500 animate-slideUp animation-delay-200">
            {loading
              ? "Finding opportunities…"
              : `${total} opportunity${total !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 animate-slideUp animation-delay-400">
          <div className="flex flex-col gap-6 border border-black bg-white p-6 sm:flex-row sm:items-center sm:justify-between transition-all duration-300 hover:shadow-lg">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s, index) => (
                <button
                  key={s.value}
                  onClick={() => setSelectedStatus(s.value)}
                  className={`relative px-4 py-2 text-xs font-medium uppercase tracking-wide transition-all duration-200 border animate-scaleIn ${
                    selectedStatus === s.value
                      ? "border-black bg-black text-white shadow-sm"
                      : "border-transparent text-neutral-400 hover:text-black hover:border-neutral-200"
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {s.label}
                  {selectedStatus === s.value && (
                    <div className="absolute inset-x-0 -bottom-px h-px bg-black animate-slideIn" />
                  )}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-widest">
                Category
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-black bg-white px-4 py-2 text-xs uppercase tracking-wide text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 cursor-pointer appearance-none bg-image-none transition-all duration-200 hover:shadow-md"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c === "All" ? "" : c}>
                    {c}
                  </option>
                ))}
              </select>
              <svg
                className="h-4 w-4 text-black pointer-events-none animate-bounce"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 border border-black bg-black px-6 py-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-white font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border border-neutral-200 bg-white p-6 rounded-lg animate-pulse"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="h-6 bg-neutral-100 rounded w-3/4" />
                  <div className="h-5 bg-neutral-100 rounded w-16" />
                </div>
                <div className="mb-4 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded w-full" />
                  <div className="h-4 bg-neutral-100 rounded w-5/6" />
                  <div className="h-4 bg-neutral-100 rounded w-4/6" />
                </div>
                <div className="mb-5 flex gap-2">
                  <div className="h-6 bg-neutral-100 rounded w-16" />
                  <div className="h-6 bg-neutral-100 rounded w-20" />
                  <div className="h-6 bg-neutral-100 rounded w-14" />
                </div>
                <div className="border-t border-neutral-200 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-5 bg-neutral-100 rounded w-20" />
                      <div className="h-4 w-px bg-neutral-200" />
                      <div className="h-4 bg-neutral-100 rounded w-12" />
                    </div>
                    <div className="h-4 bg-neutral-100 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Job grid */}
        {!loading && jobs.length > 0 && (
          <div
            className={`grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-3 transition-all duration-500 ${
              isAnimating
                ? "opacity-0 transform scale-95"
                : "opacity-100 transform scale-100"
            }`}
          >
            {jobs.map((job, index) => (
              <div
                key={job.id}
                className="animate-fadeInUp"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && !error && (
          <div className="py-24 text-center">
            <div className="mb-8">
              <div className="mx-auto w-20 h-20 border-2 border-neutral-200 rounded-lg flex items-center justify-center mb-6">
                <svg
                  className="h-10 w-10 text-neutral-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 13.255A9.001 9.001 0 0012 3a9.001 9.001 0 00-9 9.255M12 21v-9m0 0l3 3m-3-3l-3 3"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-black mb-3">
                No opportunities found
              </h3>
              <p className="text-base text-neutral-500 mb-8 max-w-md mx-auto leading-relaxed">
                Try adjusting your filters, or be the first to post an
                opportunity and connect with talented freelancers.
              </p>
            </div>
            <a
              href="/jobs/new"
              className="inline-flex items-center gap-3 border border-black bg-black px-8 py-4 text-sm font-medium uppercase tracking-widest text-white transition-all hover:bg-white hover:text-black hover:shadow-lg"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Post a Job
            </a>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-6 pt-16">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="group flex items-center gap-2 border border-black px-6 py-3 text-sm uppercase tracking-wide transition-all disabled:border-neutral-200 disabled:text-neutral-300 hover:bg-black hover:text-white disabled:hover:bg-white disabled:hover:text-black"
            >
              <svg
                className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Previous
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage(1)}
                className={`w-10 h-10 text-sm font-medium transition-all ${
                  page === 1
                    ? "border border-black bg-black text-white"
                    : "border border-neutral-200 text-neutral-600 hover:border-black hover:text-black"
                }`}
              >
                1
              </button>

              {page > 3 && <span className="text-neutral-400">...</span>}

              {page > 2 && page < totalPages - 1 && (
                <button
                  onClick={() => setPage(page)}
                  className="w-10 h-10 border border-black bg-black text-white text-sm font-medium"
                >
                  {page}
                </button>
              )}

              {page < totalPages - 2 && (
                <span className="text-neutral-400">...</span>
              )}

              {totalPages > 1 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`w-10 h-10 text-sm font-medium transition-all ${
                    page === totalPages
                      ? "border border-black bg-black text-white"
                      : "border border-neutral-200 text-neutral-600 hover:border-black hover:text-black"
                  }`}
                >
                  {totalPages}
                </button>
              )}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="group flex items-center gap-2 border border-black px-6 py-3 text-sm uppercase tracking-wide transition-all disabled:border-neutral-200 disabled:text-neutral-300 hover:bg-black hover:text-white disabled:hover:bg-white disabled:hover:text-black"
            >
              Next
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
