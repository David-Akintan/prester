"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { useChatUnread } from "@/hooks/useChatUnread";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";

export default function InboxClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, isAuthenticated, connect, isConnecting } = useWallet();
  const { conversations, refetch } = useChatUnread(isAuthenticated);

  const queryJobId = params.get("job");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    queryJobId ?? null,
  );

  // Auto-select the first conversation if nothing is preselected.
  useEffect(() => {
    if (selectedJobId) return;
    if (queryJobId) {
      setSelectedJobId(queryJobId);
      return;
    }
    if (conversations.length > 0) {
      setSelectedJobId(conversations[0].job_id);
    }
  }, [queryJobId, selectedJobId, conversations]);

  // Keep the URL in sync with the active selection so refresh works.
  useEffect(() => {
    if (!selectedJobId) return;
    if (params.get("job") === selectedJobId) return;
    const next = new URLSearchParams(params.toString());
    next.set("job", selectedJobId);
    router.replace(`/messages?${next.toString()}`, { scroll: false });
  }, [selectedJobId, params, router]);

  const selected = useMemo(
    () => conversations.find((c) => c.job_id === selectedJobId) ?? null,
    [conversations, selectedJobId],
  );

  if (!isAuthenticated) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 rounded-xl border border-default bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold text-fg">Sign in to read messages</h1>
        <p className="max-w-sm text-sm text-muted">
          Messages are private to the client and freelancer on each job. Connect
          your wallet to access your conversations.
        </p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="rounded-full border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--color-background)] hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50"
        >
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className="grid h-[78vh] gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="overflow-hidden rounded-xl border border-default bg-surface">
        <ConversationList
          conversations={conversations}
          currentAddress={address}
          selectedJobId={selectedJobId}
          onSelect={setSelectedJobId}
        />
      </aside>
      <section className="overflow-hidden rounded-xl border border-default bg-surface">
        {selected ? (
          <MessageThread
            key={selected.job_id}
            conversation={selected}
            currentAddress={address ?? ""}
            onMessagesChanged={refetch}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
            {conversations.length === 0
              ? "No conversations yet. Once a bid is accepted on one of your jobs you'll see it here."
              : "Select a conversation to start reading."}
          </div>
        )}
      </section>
    </div>
  );
}
