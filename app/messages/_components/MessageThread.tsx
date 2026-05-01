"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn, shortenAddress, formatEth } from "@/lib/utils";
import {
  messagesApi,
  type ConversationSummary,
  type MessageRow,
} from "@/lib/api";
import { subscribeToJob } from "@/lib/socket";
import Composer from "./Composer";

interface Props {
  conversation: ConversationSummary;
  currentAddress: string;
  onMessagesChanged?: () => void;
}

export default function MessageThread({
  conversation,
  currentAddress,
  onMessagesChanged,
}: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const me = currentAddress.toLowerCase();
  const other =
    conversation.client_address.toLowerCase() === me
      ? conversation.freelancer_address
      : conversation.client_address;

  const markRead = useCallback(() => {
    messagesApi.markRead(conversation.job_id).catch(() => {});
  }, [conversation.job_id]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    messagesApi
      .listMessages(conversation.job_id, { limit: 50 })
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setHasMore(data.has_more);
        stickToBottomRef.current = true;
        markRead();
        onMessagesChanged?.();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load messages.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation.job_id, markRead, onMessagesChanged]);

  // WS subscription. Falls back to a polling refetch every 30s in case the
  // socket connection silently dies — REST is the source of truth.
  useEffect(() => {
    const onMessage = (msg: MessageRow) => {
      setMessages((prev) => {
        // Already have this exact server-issued id — drop.
        if (prev.some((m) => m.id === msg.id)) return prev;

        // Race fix: if the WS event echoes back a message we just sent
        // ourselves, an optimistic placeholder (`local-…`) is already in
        // state. Replace it in place instead of appending — otherwise the
        // POST handler will later overwrite that placeholder with the same
        // server id we just appended, producing duplicate React keys.
        if (msg.sender_address && msg.sender_address.toLowerCase() === me) {
          const i = prev.findIndex(
            (m) =>
              m.id.startsWith("local-") &&
              (m.body ?? "") === (msg.body ?? "") &&
              (m.attachment_uri ?? "") === (msg.attachment_uri ?? ""),
          );
          if (i !== -1) {
            const next = prev.slice();
            next[i] = msg;
            return next;
          }
        }

        return [...prev, msg];
      });
      // If the new message is from the other side and the thread is open,
      // mark it read immediately so we don't show stale unread badges.
      if (
        msg.sender_address &&
        msg.sender_address.toLowerCase() !== me &&
        document.visibilityState === "visible"
      ) {
        markRead();
      }
      onMessagesChanged?.();
    };
    const unsub = subscribeToJob(conversation.job_id, onMessage);
    const poll = setInterval(() => {
      messagesApi
        .listMessages(conversation.job_id, { limit: 20 })
        .then((data) => {
          setMessages((prev) => mergeMessages(prev, data.messages));
        })
        .catch(() => {});
    }, 30_000);
    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [conversation.job_id, me, markRead, onMessagesChanged]);

  // Auto-scroll: stay pinned to bottom unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // User is "at the bottom" if within 80px of the floor.
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distFromBottom < 80;

    // Infinite scroll up.
    if (el.scrollTop < 80 && hasMore && !loadingMore && messages.length > 0) {
      void loadOlder();
    }
  };

  async function loadOlder() {
    if (!messages.length) return;
    const oldestId = messages[0].id;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingMore(true);
    try {
      const data = await messagesApi.listMessages(conversation.job_id, {
        before: oldestId,
        limit: 50,
      });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.has_more);
      // Preserve scroll position relative to the old top.
      requestAnimationFrame(() => {
        if (el) {
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeight;
        }
      });
    } catch {
      // surface the error inline if needed; for v1 fail silently
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSend(payload: {
    text?: string;
    attachment_uri?: string;
    attachment_name?: string;
    attachment_mime?: string;
  }) {
    const optimisticId = `local-${Date.now()}`;
    const optimistic: MessageRow = {
      id: optimisticId,
      conversation_id: conversation.job_id,
      sender_address: me,
      kind: "user",
      body: payload.text ?? null,
      attachment_uri: payload.attachment_uri ?? null,
      attachment_name: payload.attachment_name ?? null,
      attachment_mime: payload.attachment_mime ?? null,
      system_event: null,
      system_payload: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    stickToBottomRef.current = true;
    try {
      const real = await messagesApi.send(conversation.job_id, payload);
      setMessages((prev) => {
        // If the WS already delivered the real row before our POST returned,
        // the optimistic placeholder was replaced in place — `real.id` is
        // already in state. Just drop the (now-stale) optimistic row.
        const hasReal = prev.some((m) => m.id === real.id);
        if (hasReal) {
          return prev.filter((m) => m.id !== optimisticId);
        }
        return prev.map((m) => (m.id === optimisticId ? real : m));
      });
      onMessagesChanged?.();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      throw err;
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] bg-surface px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/jobs/${conversation.job_id}`}
            className="block truncate text-sm font-semibold text-fg hover:underline"
          >
            {conversation.job_title}
          </Link>
          <p className="text-xs text-muted">
            with <span className="font-mono">{shortenAddress(other)}</span>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="uppercase tracking-wide">{conversation.job_status}</span>
          </p>
        </div>
        {conversation.read_only && (
          <span className="rounded-full border border-default bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
            Read-only
          </span>
        )}
      </header>

      {/* Scroll body */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loading ? (
          <p className="py-8 text-center text-xs text-muted">Loading…</p>
        ) : error ? (
          <p className="py-8 text-center text-xs text-red-500">{error}</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">
            No messages yet. Say hi.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {loadingMore && (
              <p className="text-center text-[11px] text-muted">Loading older…</p>
            )}
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                msg={m}
                me={me}
                showSenderHeader={shouldShowSenderHeader(messages, i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer
        readOnly={conversation.read_only}
        readOnlyReason={`This conversation is read-only because the job is ${conversation.job_status}.`}
        onSend={handleSend}
      />
    </div>
  );
}

function shouldShowSenderHeader(msgs: MessageRow[], i: number): boolean {
  if (msgs[i].kind !== "user") return false;
  if (i === 0) return true;
  const prev = msgs[i - 1];
  if (prev.kind !== "user") return true;
  if (prev.sender_address !== msgs[i].sender_address) return true;
  // Time gap > 5 min → re-show header.
  return (
    new Date(msgs[i].created_at).getTime() -
      new Date(prev.created_at).getTime() >
    5 * 60_000
  );
}

function MessageBubble({
  msg,
  me,
  showSenderHeader,
}: {
  msg: MessageRow;
  me: string;
  showSenderHeader: boolean;
}) {
  if (msg.kind === "system") {
    return <SystemMessage msg={msg} />;
  }
  const mine = (msg.sender_address ?? "").toLowerCase() === me;
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      {showSenderHeader && (
        <span className="mb-0.5 text-[10px] font-mono uppercase tracking-wide text-muted">
          {mine ? "You" : shortenAddress(msg.sender_address ?? "")}
          <span className="ml-1.5 opacity-60">
            {new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
      )}
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed",
          mine
            ? "bg-[var(--fg-source)] text-[var(--bg-source)] rounded-br-sm"
            : "bg-muted text-fg rounded-bl-sm",
        )}
      >
        {msg.body && <p>{msg.body}</p>}
        {msg.attachment_uri && (
          <Attachment
            uri={msg.attachment_uri}
            name={msg.attachment_name}
            mime={msg.attachment_mime}
          />
        )}
      </div>
    </div>
  );
}

function SystemMessage({ msg }: { msg: MessageRow }) {
  if (msg.system_event === "bid_accepted" && msg.system_payload) {
    return <BidAcceptedCard msg={msg} />;
  }
  return (
    <div className="self-center rounded-full border border-default bg-muted px-3 py-1 text-[11px] uppercase tracking-wide text-muted">
      {msg.body ?? msg.system_event ?? "System message"}
    </div>
  );
}

function BidAcceptedCard({ msg }: { msg: MessageRow }) {
  const payload = msg.system_payload as {
    cover_letter?: string | null;
    proposed_timeline?: string | null;
    milestones?: Array<{
      milestone_index: number;
      description: string;
      amount_wei: string;
    }>;
  };
  return (
    <div className="self-center w-full max-w-md rounded-xl border border-[var(--color-foreground)] bg-surface p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
        Bid accepted — work begins
      </p>
      {payload.proposed_timeline && (
        <p className="mt-1 text-xs text-fg">
          <span className="text-muted">Timeline:</span>{" "}
          {payload.proposed_timeline}
        </p>
      )}
      {payload.cover_letter && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">
          {payload.cover_letter}
        </p>
      )}
      {payload.milestones && payload.milestones.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-subtle pt-2">
          {payload.milestones.map((m) => (
            <li
              key={m.milestone_index}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="text-fg">
                M{m.milestone_index} · {m.description}
              </span>
              <span className="font-mono text-muted">
                {formatEth(BigInt(m.amount_wei))} ETH
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Attachment({
  uri,
  name,
  mime,
}: {
  uri: string;
  name?: string | null;
  mime?: string | null;
}) {
  const httpUri = uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
  const isImage = (mime ?? "").startsWith("image/");

  if (isImage) {
    return (
      <a
        href={httpUri}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block overflow-hidden rounded-lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={httpUri}
          alt={name ?? "attachment"}
          className="max-h-72 max-w-full"
        />
      </a>
    );
  }
  return (
    <a
      href={httpUri}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-default bg-surface/50 px-2 py-1 text-xs text-fg hover:underline"
    >
      📎 {name ?? "attachment"}
    </a>
  );
}

function mergeMessages(prev: MessageRow[], incoming: MessageRow[]): MessageRow[] {
  const ids = new Set(prev.map((m) => m.id));
  const merged = [...prev];
  for (const m of incoming) {
    if (!ids.has(m.id)) merged.push(m);
  }
  merged.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return merged;
}
