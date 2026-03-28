"use client";

import { useState, useEffect, useCallback } from "react";
import { jobsApi, type JobRecord, ApiError } from "@/lib/api";

interface UseMyJobsResult {
  postedJobs: JobRecord[];
  activeBids: JobRecord[]; // jobs where user has a bid
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useJob(address: string | null): UseMyJobsResult {
  const [postedJobs, setPostedJobs] = useState<JobRecord[]>([]);
  const [activeBids, setActiveBids] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // const refresh = useCallback(async () => {
  //   if (!address) return;
  //   setLoading(true);
  //   setError(null);

  //   try {
  //     // Fetch all pages for the current user's jobs
  //     // Backend filters by client_address when authenticated
  //     const [posted, allOpen] = await Promise.all([
  //       jobsApi.list({ limit: 50, page: 1 }),
  //       jobsApi.list({ status: "open", limit: 50, page: 1 }),
  //     ]);

  //     // Filter client's own jobs
  //     const myPosted = posted.jobs.filter(
  //       (j) => j.client_address.toLowerCase() === address.toLowerCase(),
  //     );

  //     // Filter jobs where user has bid (open jobs that contain user's bid)
  //     const myBids = allOpen.jobs.filter((j) =>
  //       j.bids?.some(
  //         (b) => b.freelancer_address.toLowerCase() === address.toLowerCase(),
  //       ),
  //     );

  //     setPostedJobs(myPosted);
  //     setActiveBids(myBids);
  //   } catch (err) {
  //     setError(
  //       err instanceof ApiError ? err.message : "Failed to load your jobs.",
  //     );
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [address]);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      const [postedRes, openRes, inProgressRes] = await Promise.all([
        jobsApi.list({ limit: 50, page: 1 }),
        jobsApi.list({ status: "open", limit: 50, page: 1 }),
        jobsApi.list({ status: "in_progress", limit: 50, page: 1 }),
      ]);

      // Jobs this user posted as client
      const myPosted = postedRes.jobs.filter(
        (j) => j.client_address.toLowerCase() === address.toLowerCase(),
      );

      // Jobs where user has bid — check both open and in_progress
      // Use jobsApi.get() for each candidate to get full bid data
      const allJobs = [...openRes.jobs, ...inProgressRes.jobs];

      // De-duplicate by id
      const seen = new Set<string>();
      const uniqueJobs = allJobs.filter((j) => {
        if (seen.has(j.id)) return false;
        seen.add(j.id);
        return true;
      });

      // Fetch full detail (with bids) for each job to check bid presence
      const detailedJobs = await Promise.all(
        uniqueJobs.map((j) => jobsApi.get(j.id)),
      );

      const myBids = detailedJobs.filter((j) =>
        j.bids?.some(
          (b) => b.freelancer_address.toLowerCase() === address.toLowerCase(),
        ),
      );

      setPostedJobs(myPosted);
      setActiveBids(myBids);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load your jobs.",
      );
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) refresh();
  }, [address, refresh]);

  return { postedJobs, activeBids, loading, error, refresh };
}
