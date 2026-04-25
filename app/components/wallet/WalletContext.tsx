"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useConnectorClient,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { useAuth, type AuthState } from "@/hooks/useAuth";
import { useMiniPay } from "@/hooks/useMiniPay";
import { isSupportedChain, DEFAULT_CHAIN_ID } from "@/lib/chains";

export type ConnectStep =
  | "idle"
  | "requesting_accounts"
  | "awaiting_wallet_state"
  | "awaiting_signature"
  | "verifying"
  | "done"
  | "error";

interface WalletContextType extends AuthState {
  address: string | null;
  signer: JsonRpcSigner | null;
  chainId: string | null;
  connectStep: ConnectStep;
  isConnecting: boolean;
  isConnected: boolean;
  isWrongNetwork: boolean;
  walletError: string | null;
  isMiniPay: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  // ── Wagmi state ──────────────────────────────────────────
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const wagmiChainId = useChainId();
  const { connectAsync, connectors } = useConnect();

  // ── MiniPay detection + auto-connect (Celo Mini App support) ──
  // The hook owns the `window.ethereum.isMiniPay` check and auto-connect.
  const { isMiniPay } = useMiniPay();

  // ── Local state ──────────────────────────────────────────
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [connectStep, setConnectStep] = useState<ConnectStep>("idle");
  const [walletError, setWalletError] = useState<string | null>(null);

  const auth = useAuth();
  const signInRef = useRef(auth.signIn);
  signInRef.current = auth.signIn;

  const address = wagmiAddress?.toLowerCase() ?? null;
  const isConnecting =
    connectStep !== "idle" && connectStep !== "done" && connectStep !== "error";

  // ── Derive ethers signer from wagmi connector client ────
  useEffect(() => {
    if (!connectorClient || !wagmiAddress) {
      setSigner(null);
      return;
    }
    const deriveSigner = async () => {
      try {
        const provider = new BrowserProvider(
          connectorClient.transport as never,
        );
        const s = await provider.getSigner();
        setSigner(s);
      } catch (err) {
        console.error("[WalletContext] Failed to derive ethers signer:", err);
        setSigner(null);
      }
    };
    deriveSigner();
  }, [connectorClient, wagmiAddress]);

  // ── Restore session marker on mount ─────────────────────
  useEffect(() => {
    if (wagmiConnected && wagmiAddress && !auth.isAuthenticated) {
      setConnectStep("done");
    }
  }, [wagmiConnected, wagmiAddress, auth.isAuthenticated]);

  // ── Detect wallet/auth address mismatch ─────────────────
  // If the connected wallet differs from the JWT's address (e.g. user
  // switched MetaMask accounts), drop the stale session so writes don't
  // go in as the wrong client_address.
  useEffect(() => {
    if (!wagmiAddress || !auth.authAddress) return;
    if (wagmiAddress.toLowerCase() !== auth.authAddress.toLowerCase()) {
      auth.signOut();
      setConnectStep("idle");
    }
  }, [wagmiAddress, auth.authAddress, auth]);

  // ── Main connect ─────────────────────────────────────────
  // Two-phase flow: (1) open the kit; (2) once wagmi + signer are ready,
  // an effect below continues with SIWE. Doing it in one async function
  // with setTimeout races wagmi's React state propagation.
  const connect = useCallback(async () => {
    setWalletError(null);
    auth.clearAuthError();

    try {
      setConnectStep("requesting_accounts");
      const connector = connectors[0];
      if (!connector) throw new Error("No wallet connector available.");
      await connectAsync({ connector });
      // Hand off to the effect below — it fires when wagmi state lands.
      setConnectStep("awaiting_wallet_state");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed.";
      setWalletError(message);
      setConnectStep("error");
      setSigner(null);
      auth.signOut();
    }
  }, [connectAsync, connectors, auth]);

  // Phase 2 of connect: wait for wagmi to expose the address/client and for
  // the signer-derivation effect above to populate `signer`, then run SIWE.
  // Guarded so it only fires once per connect attempt.
  const siweInFlight = useRef(false);
  useEffect(() => {
    if (connectStep !== "awaiting_wallet_state") return;
    if (!wagmiAddress || !connectorClient || !signer || wagmiChainId == null) return;
    if (siweInFlight.current) return;
    siweInFlight.current = true;

    const run = async () => {
      try {
        const evmAddress = wagmiAddress.toLowerCase();
        setConnectStep("verifying");
        await signInRef.current(evmAddress, wagmiChainId, (msg: string) => {
          setConnectStep("awaiting_signature");
          return signer.signMessage(msg);
        });
        setConnectStep("done");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Sign-in failed.";
        setWalletError(message);
        setConnectStep("error");
        auth.signOut();
      } finally {
        siweInFlight.current = false;
      }
    };
    run();
  }, [connectStep, wagmiAddress, connectorClient, signer, wagmiChainId, auth]);

  // ── Listen for backend-signalled auth expiry (A4) ────────
  // apiFetch dispatches "auth:expired" on 401/403 after clearing the token.
  // We flip UI state back to idle so the user sees the Connect button and
  // re-auths cleanly instead of getting silent blanks.
  useEffect(() => {
    const handler = () => {
      auth.signOut();
      setConnectStep("idle");
      setWalletError("Your session expired. Please reconnect.");
    };
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, [auth]);

  // ── Disconnect ───────────────────────────────────────────
  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setSigner(null);
    setConnectStep("idle");
    setWalletError(null);
    auth.signOut();
  }, [wagmiDisconnect, auth]);

  // ── Switch to a supported chain (default: DEFAULT_CHAIN_ID) ──
  const switchNetwork = useCallback(async () => {
    setWalletError(null);
    try {
      await switchChainAsync({ chainId: DEFAULT_CHAIN_ID });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not switch network.";
      setWalletError(message);
    }
  }, [switchChainAsync]);

  return (
    <WalletContext.Provider
      value={{
        address,
        signer,
        chainId: wagmiChainId != null ? String(wagmiChainId) : null,
        connectStep,
        isConnecting,
        isConnected: !!address && auth.isAuthenticated,
        isWrongNetwork:
          wagmiChainId != null && !isSupportedChain(wagmiChainId),
        walletError,
        isMiniPay,
        connect,
        disconnect,
        switchNetwork,
        ...auth,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be inside <WalletProvider>");
  return ctx;
}
