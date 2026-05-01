"use client";

import { useCallback, useEffect, useState } from "react";
import { messagesApi, type ConversationSummary } from "@/lib/api";
import { getSocket } from "@/lib/socket";

// Global unread count + conversation list for the Navbar Messages icon and
// the /messages inbox sidebar. Refetches on WS `message:new` for an
// active-feeling badge without a hard polling loop.
export function useChatUnread(isAuthenticated: boolean) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await messagesApi.listConversations();
      setConversations(data.conversations);
    } catch {
      // silent — chat is non-critical UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setConversations([]);
      return;
    }
    refetch();

    // The socket fires `message:new` for any room we joined. We treat any
    // such event as a hint to refresh the inbox totals — REST is the SoT.
    const s = getSocket();
    const onAny = () => {
      refetch();
    };
    s.on("message:new", onAny);
    s.on("message:read", onAny);

    // Fallback poll every 60s in case the WS connection is silently down.
    const poll = setInterval(refetch, 60_000);

    return () => {
      s.off("message:new", onAny);
      s.off("message:read", onAny);
      clearInterval(poll);
    };
  }, [isAuthenticated, refetch]);

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0,
  );

  return { conversations, totalUnread, loading, refetch };
}
