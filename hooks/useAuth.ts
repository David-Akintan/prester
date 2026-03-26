"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
    signMessage: (message: string) => Promise<string>,
  ) => Promise<void>;
  signOut: () => void;
  clearAuthError: () => void;
}

export function useAuth(): AuthState {
  const [authAddress, setAuthAddress] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Stable ref so WalletContext's useCallback never captures a stale signIn
  const signInRef = useRef<AuthState["signIn"] | null>(null);

  // ── Restore session on mount ────────────────────────────
  // Only restore if the token was issued recently enough to still be valid.
  // This prevents a "signed in" flash followed by a 401 on the first API call.
  useEffect(() => {
    const token = getToken();
    const savedAddr = getSavedAddress();
    const issuedAt = localStorage.getItem(TOKEN_ISSUED_KEY);

    if (!token || !savedAddr) return;

    // If we don't know when it was issued, treat it as expired to be safe
    if (!issuedAt) {
      clearToken();
      localStorage.removeItem(TOKEN_ISSUED_KEY);
      return;
    }

    const age = Date.now() - parseInt(issuedAt, 10);
    if (age > TOKEN_TTL_MS) {
      // Token has expired — clear everything and force re-login
      clearToken();
      localStorage.removeItem(TOKEN_ISSUED_KEY);
      return;
    }

    setAuthAddress(savedAddr);
  }, []);

  // ── Sign in ─────────────────────────────────────────────
  const signIn = useCallback(
    async (
      address: string,
      signMessage: (message: string) => Promise<string>,
    ) => {
      setIsAuthenticating(true);
      setAuthError(null);

      try {
        // Step 1: get a one-time challenge message from the backend
        const { message } = await authApi.getNonce(address);

        // Step 2: ask the wallet to sign it — this is the popup the user sees
        const signature = await signMessage(message);

        // Step 3: backend verifies the signature and returns a JWT
        const { token, address: verifiedAddress } = await authApi.verify(
          address,
          signature,
        );

        // Step 4: persist token with issue timestamp
        setToken(token);
        saveAddress(verifiedAddress);
        localStorage.setItem(TOKEN_ISSUED_KEY, String(Date.now()));
        setAuthAddress(verifiedAddress);
      } catch (err) {
        let message = "Sign-in failed. Please try again.";

        if (err instanceof ApiError) {
          message = err.message;
        } else if (err instanceof Error) {
          const msg = err.message.toLowerCase();
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
        // Re-throw so WalletContext knows sign-in failed and can reset wallet state
        throw new Error(message);
      } finally {
        setIsAuthenticating(false);
      }
    },
    [],
  );

  // Keep ref in sync with the latest signIn so WalletContext can call it
  // via ref without a stale closure
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
