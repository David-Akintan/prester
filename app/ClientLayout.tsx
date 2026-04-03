"use client";

import { WalletProvider } from "@/app/components/wallet/WalletContext1.0";
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
      <main className="container mx-auto py-8 animate-fade-in">{children}</main>
    </WalletProvider>
  );
}
