"use client";

import { useState, useEffect, useCallback } from "react";
import {
  jobsApi,
  usersApi,
  type JobRecord,
  type FreelancerBidRow,
  ApiError,
} from "@/lib/api";

interface UseMyJobsResult {
  postedJobs: JobRecord[];
  activeBids: FreelancerBidRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useJob(address: string | null): UseMyJobsResult {
  const [postedJobs, setPostedJobs] = useState<JobRecord[]>([]);
  const [activeBids, setActiveBids] = useState<FreelancerBidRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      const [postedRes, bidsRes] = await Promise.all([
        jobsApi.list({ limit: 50, page: 1 }),
        usersApi.getMyBids(),
      ]);

      const myPosted = postedRes.jobs.filter(
        (j) => j.client_address.toLowerCase() === address.toLowerCase(),
      );

      // Show pending + accepted bids on the dashboard; filter out rejected.
      const relevant = bidsRes.bids.filter(
        (b) => b.bid_status !== "rejected",
      );

      setPostedJobs(myPosted);
      setActiveBids(relevant);
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
