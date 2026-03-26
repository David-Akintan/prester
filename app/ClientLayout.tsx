"use client";

import { WalletProvider } from "@/app/components/wallet/WalletContext";
import Navbar from "@/app/components/layout/Navbar";

// This is the ONLY ClientLayout. It is imported by app/layout.tsx.
// Delete frontend/app/components/ClientLayout.tsx — it is a duplicate.
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </WalletProvider>
  );
}
