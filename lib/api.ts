/**
 * API client for the Prester backend.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let _token: string | null = null;

export function getToken(): string | null {
  if (_token) return _token;
  if (typeof window !== "undefined") {
    _token = localStorage.getItem("fl3_token");
  }
  return _token;
}

export function setToken(token: string) {
  _token = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("fl3_token", token);
  }
}

export function clearToken() {
  _token = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("fl3_token");
    localStorage.removeItem("fl3_address");
  }
}

export function saveAddress(address: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("fl3_address", address.toLowerCase());
  }
}

export function getSavedAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fl3_address");
}

interface ApiOptions extends RequestInit {
  auth?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "UNKNOWN",
      err.message ?? "An unexpected error occurred.",
    );
  }

  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────

export const authApi = {
  getNonce(address: string): Promise<{ nonce: string; message: string }> {
    return apiFetch(`/auth/nonce?address=${address}`, { auth: false });
  },

  verify(
    address: string,
    signature: string,
  ): Promise<{ token: string; address: string }> {
    return apiFetch("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ address, signature }),
      auth: false,
    });
  },
};

// ─── Jobs ─────────────────────────────────────────────────────

export interface JobListParams {
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface JobListResponse {
  jobs: JobRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface JobRecord {
  id: string;
  chain_job_id: number | null;
  client_address: string;
  client_username: string | null;
  client_avatar: string | null;
  title: string;
  description: string;
  category: string | null;
  tags: string[];
  required_skills: string[];
  estimated_duration: string | null;
  metadata_uri: string | null;
  total_amount_wei: string;
  status: "draft" | "open" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  milestones: MilestoneRecord[];
  bids: BidRecord[];
}

export interface MilestoneRecord {
  id: string;
  job_id: string;
  milestone_index: number;
  description: string;
  amount_wei: string;
  deliverable_uri: string | null;
  status: "pending" | "submitted" | "approved" | "disputed" | "resolved";
}

export interface BidRecord {
  id: string;
  job_id: string;
  freelancer_address: string;
  username: string | null;
  avatar_url: string | null;
  cover_letter: string;
  proposed_timeline: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface CreateJobPayload {
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  required_skills?: string[];
  estimated_duration?: string;
  metadata_uri?: string;
  total_amount_wei: string;
  milestones: { description: string; amount_wei: string }[];
}

export const jobsApi = {
  list(params: JobListParams = {}): Promise<JobListResponse> {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiFetch(`/jobs${qs ? `?${qs}` : ""}`, { auth: false });
  },

  get(id: string): Promise<JobRecord> {
    return apiFetch(`/jobs/${id}`, { auth: false });
  },

  create(payload: CreateJobPayload): Promise<JobRecord> {
    return apiFetch("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  confirm(
    id: string,
    chainJobId: number,
    metadataUri?: string,
  ): Promise<JobRecord> {
    return apiFetch(`/jobs/${id}/confirm`, {
      method: "PATCH",
      body: JSON.stringify({
        chain_job_id: chainJobId,
        metadata_uri: metadataUri,
      }),
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiFetch(`/jobs/${id}`, { method: "DELETE" });
  },
};

// ─── Bids ─────────────────────────────────────────────────────

export interface CreateBidPayload {
  cover_letter: string;
  proposed_timeline?: string;
}

export const bidsApi = {
  create(jobId: string, payload: CreateBidPayload): Promise<BidRecord> {
    return apiFetch(`/jobs/${jobId}/bids`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  accept(jobId: string, bidId: string): Promise<{ bid: BidRecord }> {
    return apiFetch(`/jobs/${jobId}/bids/${bidId}/accept`, {
      method: "POST",
    });
  },
};

// ─── IPFS (proxied through backend) ──────────────────────────

export const ipfsApi = {
  upload(
    content: Record<string, unknown>,
    type: "metadata" | "deliverable" | "evidence" | "verdict",
  ): Promise<{ uri: string }> {
    return apiFetch("/ipfs/upload", {
      method: "POST",
      body: JSON.stringify({ content, type }),
    });
  },
};
