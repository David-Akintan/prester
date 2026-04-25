"use client";

import nacl from "tweetnacl";
import { sha256 } from "@noble/hashes/sha256";
import { getAddress, type Signer } from "ethers";

// Internal module. All names/strings here are *internal*. User-facing
// strings live in the calling components so copy review has one place to
// look — see plan2.md "Copy audit checklist".

const SCHEMA = "prester.nda.v1";
const ALG = "x25519-xsalsa20poly1305+aes-gcm-256";
const PAYLOAD_SCHEMA = "prester.nda.payload.v1";

const DERIVATION_MESSAGE_V1 = (jobId: string, chainId: number) =>
  `Prester NDA key derivation v1\njob=${jobId}\nchain=${chainId}`;

export interface Keypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface RecipientEntry {
  address: string;
  senderPub: string;
  nonce: string;
  box: string;
}

export interface Envelope {
  schema: string;
  alg: string;
  iv: string;
  ciphertext: string;
  recipients: RecipientEntry[];
}

export interface RecipientKey {
  address: string;
  x25519_pub: string;
}

interface TextDeliverablePayload {
  schema: typeof PAYLOAD_SCHEMA;
  kind: "text";
  text: string;
}

interface FileDeliverablePayload {
  schema: typeof PAYLOAD_SCHEMA;
  kind: "file";
  name: string;
  mimeType: string | null;
  bytes: string;
}

type DeliverablePayload = TextDeliverablePayload | FileDeliverablePayload;

export type DecodedDeliverable =
  | { kind: "text"; text: string; legacy: boolean }
  | {
      kind: "file";
      name: string;
      mimeType: string;
      bytes: Uint8Array;
      legacy: boolean;
    };

function toOwnedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toOwnedBytes(rawKey),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

// ─── Base64 helpers ───────────────────────────────────────────

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ─── Deterministic keypair from wallet signature ─────────────
//
// Signing a canonical per-job message with the wallet produces a
// deterministic signature under ECDSA-secp256k1 + RFC 6979 (every major
// wallet follows this today). SHA-256 of that signature is the X25519
// secret. Same wallet + same job always yields the same keypair —
// re-derivable on any device.

function sessionKey(jobId: string, address: string): string {
  return `prester.nda.kp.${jobId}.${address.toLowerCase()}`;
}

function loadCachedKeypair(
  jobId: string,
  address: string,
): Keypair | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(jobId, address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pk: string; sk: string };
    return {
      publicKey: fromB64(parsed.pk),
      secretKey: fromB64(parsed.sk),
    };
  } catch {
    return null;
  }
}

function saveCachedKeypair(
  jobId: string,
  address: string,
  kp: Keypair,
): void {
  try {
    sessionStorage.setItem(
      sessionKey(jobId, address),
      JSON.stringify({ pk: toB64(kp.publicKey), sk: toB64(kp.secretKey) }),
    );
  } catch {
    // sessionStorage full / disabled — non-fatal, caller re-derives next time.
  }
}

export async function getOrDeriveMyKeypair(
  signer: Signer,
  jobId: string,
  chainId: number,
): Promise<Keypair> {
  const address = getAddress(await signer.getAddress());
  const cached = loadCachedKeypair(jobId, address);
  if (cached) return cached;

  const sig = await signer.signMessage(
    DERIVATION_MESSAGE_V1(jobId, chainId),
  );
  // signMessage returns hex "0x…"; hash the raw bytes.
  const sigBytes = fromHex(sig);
  const seed = sha256(sigBytes);
  // tweetnacl box keypair accepts a 32-byte secret via fromSecretKey.
  const kp = nacl.box.keyPair.fromSecretKey(seed.slice(0, 32));
  const out: Keypair = { publicKey: kp.publicKey, secretKey: kp.secretKey };
  saveCachedKeypair(jobId, address, out);
  return out;
}

export function clearCachedKeypair(jobId: string, address: string): void {
  try {
    sessionStorage.removeItem(sessionKey(jobId, address));
  } catch {
    /* ignore */
  }
}

function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ─── Encryption / decryption ─────────────────────────────────

export async function encryptForRecipients(
  plaintext: Uint8Array,
  senderKeypair: Keypair,
  recipients: RecipientKey[],
): Promise<Envelope> {
  if (recipients.length === 0) {
    throw new Error("NDA_ENCRYPT_NO_RECIPIENTS");
  }

  // Random AES-GCM key + IV for the payload. K is wrapped separately per
  // recipient using NaCl box (X25519 + XSalsa20-Poly1305).
  const K = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await importAesGcmKey(K);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toOwnedBytes(iv) },
      aesKey,
      toOwnedBytes(plaintext),
    ),
  );

  const senderPubB64 = toB64(senderKeypair.publicKey);
  const entries: RecipientEntry[] = recipients.map((r) => {
    const pub = fromB64(r.x25519_pub);
    const nonce = crypto.getRandomValues(new Uint8Array(nacl.box.nonceLength));
    const boxed = nacl.box(K, nonce, pub, senderKeypair.secretKey);
    return {
      address: getAddress(r.address),
      senderPub: senderPubB64,
      nonce: toB64(nonce),
      box: toB64(boxed),
    };
  });

  return {
    schema: SCHEMA,
    alg: ALG,
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
    recipients: entries,
  };
}

export async function decryptAsRecipient(
  envelope: Envelope,
  myAddress: string,
  myKeypair: Keypair,
): Promise<Uint8Array> {
  if (envelope.schema !== SCHEMA) {
    throw new Error("NDA_UNKNOWN_SCHEMA");
  }
  const normalized = getAddress(myAddress);
  const entry = envelope.recipients.find(
    (r) => getAddress(r.address) === normalized,
  );
  if (!entry) {
    throw new Error("NDA_NOT_A_RECIPIENT");
  }
  const senderPub = fromB64(entry.senderPub);
  const nonce = fromB64(entry.nonce);
  const boxed = fromB64(entry.box);
  const K = nacl.box.open(boxed, nonce, senderPub, myKeypair.secretKey);
  if (!K) throw new Error("NDA_DECRYPT_KEY_FAILED");

  const iv = fromB64(envelope.iv);
  const ciphertext = fromB64(envelope.ciphertext);
  const aesKey = await importAesGcmKey(K);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toOwnedBytes(iv) },
    aesKey,
    toOwnedBytes(ciphertext),
  );
  return new Uint8Array(plaintext);
}

// ─── UTF-8 helpers for text deliverables ─────────────────────

export function isEnvelopeRecipient(
  envelope: Envelope,
  address: string,
): boolean {
  const normalized = getAddress(address);
  return envelope.recipients.some(
    (recipient) => getAddress(recipient.address) === normalized,
  );
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

export async function encodeDeliverableManifest(
  file: File | null,
  textBody: string,
): Promise<Uint8Array> {
  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return utf8Encode(
      JSON.stringify({
        schema: PAYLOAD_SCHEMA,
        kind: "file",
        name: file.name,
        mimeType: file.type || null,
        bytes: toB64(bytes),
      } satisfies FileDeliverablePayload),
    );
  }

  return utf8Encode(
    JSON.stringify({
      schema: PAYLOAD_SCHEMA,
      kind: "text",
      text: textBody,
    } satisfies TextDeliverablePayload),
  );
}

export function decodeDeliverablePayload(
  plaintext: Uint8Array,
): DecodedDeliverable {
  const manifest = tryParseDeliverablePayload(plaintext);
  if (manifest?.kind === "text") {
    return { kind: "text", text: manifest.text, legacy: false };
  }
  if (manifest?.kind === "file") {
    return {
      kind: "file",
      name: manifest.name || "confidential-deliverable.bin",
      mimeType: manifest.mimeType || "application/octet-stream",
      bytes: fromB64(manifest.bytes),
      legacy: false,
    };
  }

  const legacyText = tryDecodeLegacyText(plaintext);
  if (legacyText != null) {
    return { kind: "text", text: legacyText, legacy: true };
  }

  return {
    kind: "file",
    name: "confidential-deliverable.bin",
    mimeType: "application/octet-stream",
    bytes: Uint8Array.from(plaintext),
    legacy: true,
  };
}

// ─── Public accessor for keypair pubkey in base64 ────────────

export function encodePubKey(keypair: Keypair): string {
  return toB64(keypair.publicKey);
}

function tryParseDeliverablePayload(
  plaintext: Uint8Array,
): DeliverablePayload | null {
  try {
    const raw = utf8Decode(plaintext);
    const parsed = JSON.parse(raw) as Partial<DeliverablePayload>;
    if (parsed.schema !== PAYLOAD_SCHEMA) {
      return null;
    }
    if (parsed.kind === "text" && typeof parsed.text === "string") {
      return parsed as TextDeliverablePayload;
    }
    if (
      parsed.kind === "file" &&
      typeof parsed.name === "string" &&
      (typeof parsed.mimeType === "string" || parsed.mimeType === null) &&
      typeof parsed.bytes === "string"
    ) {
      return parsed as FileDeliverablePayload;
    }
    return null;
  } catch {
    return null;
  }
}

function tryDecodeLegacyText(plaintext: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
    const trimmed = text.trim();
    if (!trimmed || /\u0000/.test(text)) {
      return null;
    }
    return looksMostlyText(text) ? text : null;
  } catch {
    return null;
  }
}

function looksMostlyText(text: string): boolean {
  let printable = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      code >= 160
    ) {
      printable += 1;
    }
  }
  return printable / text.length >= 0.9;
}
