// Thin wrapper around socket.io-client used by the chat UI.
//
// REST is the source of truth; this socket only delivers low-latency hints
// for `message:new` and `message:read`. Components must always re-fetch via
// the REST API on (re)connect to backfill anything that was missed while
// the socket was down.
//
// Authentication: piggybacks on the existing Bearer token persisted in
// localStorage by `lib/api.ts`. The handshake passes it via socket.io's
// `auth.token`; the server-side middleware in `backend/src/server.ts`
// validates it with the same `verifyToken` used by REST middleware.

import { io, Socket } from "socket.io-client";
import { getToken, clearToken, type MessageRow } from "./api";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let _socket: Socket | null = null;
let _tokenAtConnect: string | null = null;

function buildSocket(): Socket {
  const token = getToken();
  _tokenAtConnect = token;

  const s = io(BASE_URL, {
    path: "/ws",
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
  });

  s.on("connect_error", (err: Error) => {
    if (err.message === "UNAUTHORIZED") {
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:expired"));
      }
    }
  });

  return s;
}

export function getSocket(): Socket {
  // If the persisted token rotated since we last connected, tear down the
  // old socket so the next connect picks up the new credentials.
  if (_socket && getToken() !== _tokenAtConnect) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
  if (!_socket) {
    _socket = buildSocket();
  }
  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
    _tokenAtConnect = null;
  }
}

export interface MessageReadEvent {
  address: string;
  at: string;
}

// Subscribe to a single job's chat room. Returns an unsubscribe fn that
// detaches handlers and asks the server to leave the room.
export function subscribeToJob(
  jobId: string,
  onMessage: (msg: MessageRow) => void,
  onRead?: (evt: MessageReadEvent) => void,
): () => void {
  const s = getSocket();

  const handleNew = (msg: MessageRow) => {
    if (msg.conversation_id === jobId) onMessage(msg);
  };
  const handleRead = (evt: MessageReadEvent) => {
    onRead?.(evt);
  };

  // Always (re-)join — covers reconnects when the join state was lost.
  const join = () => s.emit("join", jobId);
  if (s.connected) {
    join();
  } else {
    s.once("connect", join);
  }
  s.on("connect", join);

  s.on("message:new", handleNew);
  s.on("message:read", handleRead);

  return () => {
    s.off("connect", join);
    s.off("message:new", handleNew);
    s.off("message:read", handleRead);
    s.emit("leave", jobId);
  };
}

// Reconnect when token rotates so the global unread badge picks up live
// events under the new identity.
if (typeof window !== "undefined") {
  window.addEventListener("auth:expired", () => disconnectSocket());
}
