"use client";

import { useState, useEffect, useCallback } from "react";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function useNotifications(isAuthenticated: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("fl3_token");
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {
      // Silent fail — notifications are non-critical
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const token = localStorage.getItem("fl3_token");
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/notifications/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
      // Silent fail
    }
  }, []);

  // Initial fetch + poll every 15s
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  return {
    notifications,
    unread,
    loading,
    markAllRead,
    refetch: fetchNotifications,
  };
}
