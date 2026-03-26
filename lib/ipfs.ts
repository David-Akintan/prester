import type { JobMetadata } from "@/index";

/**
 * Uploads job metadata JSON to IPFS via the Next.js API route.
 *
 * BUG FIX: The original called "/api/ipfs/upload" but the actual
 * Next.js route file lives at app/api/upload/route.ts, which maps
 * to the URL path "/api/upload". Calling the wrong path caused a
 * 404 on every metadata upload, silently breaking job creation.
 */
export async function uploadJobMetadata(
  metadata: JobMetadata,
): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: metadata, type: "metadata" }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message ?? "IPFS upload failed");
  }

  const { uri } = await res.json();
  return uri as string;
}

/**
 * Fetches and parses job metadata from IPFS.
 */
export async function fetchJobMetadata(
  ipfsUri: string,
): Promise<JobMetadata | null> {
  if (!ipfsUri) return null;

  const gateway =
    process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";
  const url = ipfsUri.startsWith("ipfs://")
    ? ipfsUri.replace("ipfs://", gateway)
    : ipfsUri;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json() as Promise<JobMetadata>;
  } catch {
    return null;
  }
}
