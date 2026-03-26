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
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { useAuth, type AuthState } from "@/hooks/useAuth";
import { config } from "@/lib/config";

// ─── Connection steps — drives the UI label ──────────────────

export type ConnectStep =
  | "idle"
  | "requesting_accounts" // MetaMask account selection popup
  | "switching_network" // switching to Sepolia
  | "awaiting_signature" // the sign message popup
  | "verifying" // backend JWT exchange
  | "done"
  | "error";

// ─── Context shape ────────────────────────────────────────────

interface WalletContextType extends AuthState {
  address: string | null;
  signer: JsonRpcSigner | null;
  chainId: string | null;
  connectStep: ConnectStep;
  isConnecting: boolean; // true during any connect step
  isConnected: boolean; // wallet address obtained
  isWrongNetwork: boolean;
  walletError: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

// Sepolia chain params — hard-coded so we never depend on a config
// variable being wrong for the critical network-switch call
const SEPOLIA = {
  chainId: "0xaa36a7", // 11155111 decimal
  chainName: "Sepolia Testnet",
  rpcUrls: ["https://rpc.sepolia.org"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
} as const;

// ─── Provider ─────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connectStep, setConnectStep] = useState<ConnectStep>("idle");
  const [walletError, setWalletError] = useState<string | null>(null);

  const auth = useAuth();

  // Stable ref to auth.signIn — prevents stale closure in connect()
  const signInRef = useRef(auth.signIn);
  signInRef.current = auth.signIn;

  const isConnecting =
    connectStep !== "idle" && connectStep !== "done" && connectStep !== "error";
  const isWrongNetwork =
    !!chainId && chainId.toLowerCase() !== SEPOLIA.chainId.toLowerCase();

  // ── Internal: read chain id from provider ────────────────
  async function getChainIdHex(provider: BrowserProvider): Promise<string> {
    const network = await provider.getNetwork();
    return `0x${network.chainId.toString(16)}`;
  }

  // ── Auto-reconnect on mount ──────────────────────────────
  // Silently restore wallet state if the user previously approved the site.
  // Does NOT trigger the sign-in flow — the user must click Connect for that.
  // This keeps the address/signer available for read-only operations.
  useEffect(() => {
    const tryAutoConnect = async () => {
      if (typeof window === "undefined" || !window.ethereum) return;
      try {
        const provider = new BrowserProvider(window.ethereum as never);
        const accounts = await provider.listAccounts();
        if (accounts.length === 0) return;

        const s = await provider.getSigner();
        const addr = await s.getAddress();
        const cid = await getChainIdHex(provider);

        setSigner(s);
        setAddress(addr);
        setChainId(cid);
        // Note: we do NOT call signIn here.
        // isAuthenticated is restored by useAuth from localStorage.
        // If the token expired, useAuth will have cleared it and the
        // user will see "Signing in…" in the badge, prompting them to re-connect.
      } catch {
        // Not approved yet — nothing to do
      }
    };

    tryAutoConnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wallet event listeners ───────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const eth = window.ethereum as {
      on: (e: string, fn: (...a: unknown[]) => void) => void;
      removeListener: (e: string, fn: (...a: unknown[]) => void) => void;
    };

    const onAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected or locked MetaMask
        setAddress(null);
        setSigner(null);
        setChainId(null);
        setConnectStep("idle");
        auth.signOut();
        return;
      }
      // User switched account — update signer but don't re-sign
      try {
        const provider = new BrowserProvider(window.ethereum as never);
        const s = await provider.getSigner();
        const addr = await s.getAddress();
        const cid = await getChainIdHex(provider);
        setSigner(s);
        setAddress(addr);
        setChainId(cid);
        // Clear backend auth since the address changed
        auth.signOut();
      } catch {
        /* ignore */
      }
    };

    const onChainChanged = (newChainId: string) => {
      // Reload on chain change — safest way to avoid stale provider state
      setChainId(newChainId);
      window.location.reload();
    };

    const onDisconnect = () => {
      setAddress(null);
      setSigner(null);
      setChainId(null);
      setConnectStep("idle");
      auth.signOut();
    };

    eth.on("accountsChanged", onAccountsChanged as never);
    eth.on("chainChanged", onChainChanged as never);
    eth.on("disconnect", onDisconnect);

    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged as never);
      eth.removeListener("chainChanged", onChainChanged as never);
      eth.removeListener("disconnect", onDisconnect);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch to Sepolia ────────────────────────────────────
  const switchNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    setWalletError(null);

    const request = (
      window.ethereum as {
        request: (a: unknown) => Promise<unknown>;
      }
    ).request.bind(window.ethereum);

    try {
      await request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA.chainId }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        // Chain not in wallet yet — add it
        try {
          await request({
            method: "wallet_addEthereumChain",
            params: [SEPOLIA],
          });
        } catch {
          setWalletError(
            "Could not add Sepolia to your wallet. Please add it manually.",
          );
        }
      } else if (code === 4001) {
        setWalletError("Network switch rejected.");
      } else {
        setWalletError(
          "Could not switch to Sepolia. Please switch manually in MetaMask.",
        );
      }
    }
  }, []);

  // ── Main connect flow ────────────────────────────────────
  //
  // Step 1 — eth_requestAccounts  →  MetaMask account popup
  // Step 2 — wallet_switchEthereumChain  →  ensure Sepolia
  // Step 3 — signMessage  →  the "Sign this message" popup
  // Step 4 — POST /auth/verify  →  JWT from backend
  //
  const connect = useCallback(async () => {
    setWalletError(null);
    auth.clearAuthError();

    if (typeof window === "undefined" || !window.ethereum) {
      setWalletError("No wallet detected. Please install MetaMask.");
      setConnectStep("error");
      return;
    }

    const request = (
      window.ethereum as {
        request: (a: unknown) => Promise<unknown>;
      }
    ).request.bind(window.ethereum);

    try {
      // ── Step 1: Request account access ──────────────────
      setConnectStep("requesting_accounts");
      await request({ method: "eth_requestAccounts" });

      const provider = new BrowserProvider(window.ethereum as never);
      const s = await provider.getSigner();
      const addr = await s.getAddress();

      // ── Step 2: Ensure Sepolia ───────────────────────────
      const cid = await getChainIdHex(provider);
      if (cid.toLowerCase() !== SEPOLIA.chainId.toLowerCase()) {
        setConnectStep("switching_network");
        try {
          await request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA.chainId }],
          });
        } catch (switchErr: unknown) {
          const code = (switchErr as { code?: number })?.code;
          if (code === 4902) {
            await request({
              method: "wallet_addEthereumChain",
              params: [SEPOLIA],
            });
          } else if (code === 4001) {
            throw new Error("You must switch to Sepolia to use Prester.");
          } else {
            throw new Error(
              "Could not switch to Sepolia. Please switch manually.",
            );
          }
        }
        // After switch, reload provider so chainId is fresh
        const freshProvider = new BrowserProvider(window.ethereum as never);
        const freshCid = await getChainIdHex(freshProvider);
        setChainId(freshCid);
      } else {
        setChainId(cid);
      }

      // Persist wallet state (signer is good regardless of chain result above)
      setSigner(s);
      setAddress(addr);

      // ── Step 3 + 4: Sign message → verify with backend ──
      setConnectStep("awaiting_signature");
      // Small delay so the UI label updates before the popup appears
      await new Promise((r) => setTimeout(r, 80));

      setConnectStep("verifying");
      await signInRef.current(addr, (msg: string) => {
        // Switch step label back to signature while the popup is open
        setConnectStep("awaiting_signature");
        return s.signMessage(msg);
      });

      setConnectStep("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed.";
      setWalletError(message);
      setConnectStep("error");

      // If we failed after getting the address, clear wallet state too
      // so the UI doesn't show a half-connected state
      setAddress(null);
      setSigner(null);
      setChainId(null);
      auth.signOut();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disconnect ───────────────────────────────────────────
  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setChainId(null);
    setConnectStep("idle");
    setWalletError(null);
    auth.signOut();
  }, [auth]);

  return (
    <WalletContext.Provider
      value={{
        address,
        signer,
        chainId,
        connectStep,
        isConnecting,
        isConnected: !!address && auth.isAuthenticated,
        isWrongNetwork,
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

// ─── Hook ─────────────────────────────────────────────────────

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be inside <WalletProvider>");
  return ctx;
}
