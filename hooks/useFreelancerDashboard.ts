"use client";

import { useState, useEffect, useCallback } from "react";
import { usersApi, type FreelancerDashboard, ApiError } from "@/lib/api";

interface UseFreelancerDashboardResult {
  dashboard: FreelancerDashboard | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFreelancerDashboard(): UseFreelancerDashboardResult {
  const [dashboard, setDashboard] = useState<FreelancerDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await usersApi.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}
