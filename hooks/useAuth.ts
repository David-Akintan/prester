"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getAddress } from "ethers";
import {
  authApi,
  setToken,
  clearToken,
  getToken,
  saveAddress,
  getSavedAddress,
  ApiError,
} from "@/lib/api";

// How long a JWT is valid — must match the backend (7 days in ms)
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_ISSUED_KEY = "fl3_token_issued";

export interface AuthState {
  authAddress: string | null;
  isAuthenticating: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  signIn: (
    address: string,
    chainId: number,
    signMessage: (message: string) => Promise<string>,
  ) => Promise<void>;
  signOut: () => void;
  clearAuthError: () => void;
}

/**
 * Build an EIP-4361 SIWE message string.
 * We construct it manually to avoid importing the `siwe` package
 * (which pulls Node.js-only dependencies that break in the browser).
 *
 * Format spec: https://eips.ethereum.org/EIPS/eip-4361
 */
function buildSiweMessage(params: {
  domain: string;
  address: string;
  uri: string;
  nonce: string;
  chainId: number;
  issuedAt: string;
}): string {
  // EIP-4361 requires EIP-55 checksummed address.
  // The wallet provides this, but lowercase addresses from the backend won't parse.
  // Wagmi/ethers signers always return checksummed, so this should be fine,
  // but we guard against it just in case.
  const lines = [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    "Sign in to Prester",
    "",
    `URI: ${params.uri}`,
    `Version: 1`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ];
  return lines.join("\n");
}

export function useAuth(): AuthState {
  const [authAddress, setAuthAddress] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const signInRef = useRef<AuthState["signIn"] | null>(null);

  // ── Restore session on mount ────────────────────────────
  useEffect(() => {
    const token = getToken();
    const savedAddr = getSavedAddress();
    const issuedAt = localStorage.getItem(TOKEN_ISSUED_KEY);

    if (!token || !savedAddr) return;

    if (!issuedAt) {
      clearToken();
      localStorage.removeItem(TOKEN_ISSUED_KEY);
      return;
    }

    const age = Date.now() - parseInt(issuedAt, 10);
    if (age > TOKEN_TTL_MS) {
      clearToken();
      localStorage.removeItem(TOKEN_ISSUED_KEY);
      return;
    }

    setAuthAddress(savedAddr);
  }, []);

  // ── Sign in with SIWE ──────────────────────────────────
  const signIn = useCallback(
    async (
      address: string,
      chainId: number,
      signMessage: (message: string) => Promise<string>,
    ) => {
      setIsAuthenticating(true);
      setAuthError(null);

      try {
        // Step 1: get a one-time nonce from the backend
        const { nonce } = await authApi.getNonce(address);

        // Step 2: construct an EIP-4361 SIWE message.
        // The message body must carry an EIP-55 checksummed address; the
        // SIWE parser on the backend rejects all-lowercase. API/DB calls
        // elsewhere stay lowercase.
        const checksummedAddress = getAddress(address);
        const messageStr = buildSiweMessage({
          domain: window.location.host,
          address: checksummedAddress,
          uri: window.location.origin,
          nonce,
          chainId,
          issuedAt: new Date().toISOString(),
        });

        // Step 3: ask the wallet to sign the SIWE message
        const signature = await signMessage(messageStr);

        // Step 4: backend verifies the SIWE message + signature and returns JWT
        const { token, address: verifiedAddress } = await authApi.verify(
          messageStr,
          signature,
        );

        // Step 5: persist
        setToken(token);
        saveAddress(verifiedAddress);
        localStorage.setItem(TOKEN_ISSUED_KEY, String(Date.now()));
        setAuthAddress(verifiedAddress);
      } catch (err) {
        let message = "Sign-in failed. Please try again.";

        const raw = err instanceof Error ? err.message : "";
        const unsupportedChainMatch = raw.match(
          /SIWE chainId (\d+) is not supported\. Supported: ([\d,\s]+)/i,
        );
        if (unsupportedChainMatch) {
          const attempted = unsupportedChainMatch[1];
          const supported = unsupportedChainMatch[2]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .join(", ");
          message =
            `This network (chainId ${attempted}) isn't enabled on the server. ` +
            `Switch your wallet to one of: ${supported}, then try connecting again.`;
        } else if (err instanceof ApiError) {
          message = err.message;
        } else if (err instanceof Error) {
          const msg = raw.toLowerCase();
          if (
            msg.includes("rejected") ||
            msg.includes("denied") ||
            msg.includes("action_rejected") ||
            msg.includes("user rejected")
          ) {
            message =
              "Signature rejected. You must sign the message to continue.";
          } else if (msg.includes("nonce")) {
            message = "Session expired. Please try connecting again.";
          } else {
            message = err.message;
          }
        }

        setAuthError(message);
        throw new Error(message);
      } finally {
        setIsAuthenticating(false);
      }
    },
    [],
  );

  signInRef.current = signIn;

  const signOut = useCallback(() => {
    clearToken();
    localStorage.removeItem(TOKEN_ISSUED_KEY);
    setAuthAddress(null);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return {
    authAddress,
    isAuthenticating,
    authError,
    isAuthenticated: !!authAddress,
    signIn,
    signOut,
    clearAuthError,
  };
}
