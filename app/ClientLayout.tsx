"use client";

import { WalletProvider } from "@/app/components/wallet/WalletContext";
import { ThemeProvider } from "@/app/components/theme/ThemeProvider";
import Navbar from "@/app/components/layout/Navbar";
import { OnboardingBanner } from "@/app/components/onboarding/OnboardingBanner";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
          {children}
        </main>
      </WalletProvider>
    </ThemeProvider>
  );
}
