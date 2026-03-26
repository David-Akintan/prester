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

export function useMyJobs(address: string | null): UseMyJobsResult {
  const [postedJobs, setPostedJobs] = useState<JobRecord[]>([]);
  const [activeBids, setActiveBids] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch all pages for the current user's jobs
      // Backend filters by client_address when authenticated
      const [posted, allOpen] = await Promise.all([
        jobsApi.list({ limit: 50, page: 1 }),
        jobsApi.list({ status: "open", limit: 50, page: 1 }),
      ]);

      // Filter client's own jobs
      const myPosted = posted.jobs.filter(
        (j) => j.client_address.toLowerCase() === address.toLowerCase(),
      );

      // Filter jobs where user has bid (open jobs that contain user's bid)
      const myBids = allOpen.jobs.filter((j) =>
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
