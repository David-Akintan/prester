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
import { useAccount, useConnectorClient, useDisconnect } from "wagmi";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { useAuth, type AuthState } from "@/hooks/useAuth";
import { activeChain } from "@/lib/initia";

export type ConnectStep =
  | "idle"
  | "requesting_accounts"
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

  // ── InterwovenKit ────────────────────────────────────────
  const { openConnect, username } = useInterwovenKit();

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
  // This is the key bridge: wagmi gives us the EIP-1193 provider,
  // ethers wraps it so existing contract.ts calls work unchanged.
  useEffect(() => {
    if (!connectorClient || !wagmiAddress) {
      setSigner(null);
      return;
    }

    const deriveSigner = async () => {
      try {
        const provider = new BrowserProvider(connectorClient.transport as any);
        const s = await provider.getSigner();
        setSigner(s);
      } catch (err) {
        console.error("[WalletContext] Failed to derive ethers signer:", err);
        setSigner(null);
      }
    };

    deriveSigner();
  }, [connectorClient, wagmiAddress]);

  // ── Restore auth session on mount ───────────────────────
  useEffect(() => {
    if (wagmiConnected && wagmiAddress && !auth.isAuthenticated) {
      // Wallet was previously connected (wagmi persists this)
      // but JWT may have expired — user will need to re-sign
      setConnectStep("done");
    }
  }, [wagmiConnected, wagmiAddress, auth.isAuthenticated]);

  // ── Main connect ─────────────────────────────────────────
  const connect = useCallback(async () => {
    setWalletError(null);
    auth.clearAuthError();

    try {
      setConnectStep("requesting_accounts");
      await openConnect();

      // Wait for wagmi state to propagate after modal closes
      await new Promise((r) => setTimeout(r, 300));

      // wagmiAddress and connectorClient are already in scope from
      // useAccount() and useConnectorClient() hooks at the top of the component.
      // No dynamic imports needed.
      if (!wagmiAddress) {
        throw new Error("Wallet connected but no address found.");
      }

      if (!connectorClient) {
        throw new Error("No connector client available.");
      }

      const evmAddress = wagmiAddress.toLowerCase();

      const provider = new BrowserProvider(connectorClient.transport as any);
      const s = await provider.getSigner();
      setSigner(s);

      setConnectStep("awaiting_signature");
      await new Promise((r) => setTimeout(r, 80));

      setConnectStep("verifying");
      await signInRef.current(evmAddress, (msg: string) => {
        setConnectStep("awaiting_signature");
        return s.signMessage(msg);
      });

      setConnectStep("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed.";
      setWalletError(message);
      setConnectStep("error");
      setSigner(null);
      auth.signOut();
    }
  }, [openConnect, wagmiAddress, connectorClient, auth]);

  // ── Disconnect ───────────────────────────────────────────
  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setSigner(null);
    setConnectStep("idle");
    setWalletError(null);
    auth.signOut();
  }, [wagmiDisconnect, auth]);

  // switchNetwork is a no-op — InterwovenKit manages chain switching
  const switchNetwork = useCallback(async () => {}, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        signer,
        chainId: String(activeChain.id),
        connectStep,
        isConnecting,
        isConnected: !!address && auth.isAuthenticated,
        isWrongNetwork: false,
        walletError,
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
