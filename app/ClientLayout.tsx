"use client";

import { WalletProvider } from "@/app/components/wallet/WalletContext";
import { ThemeProvider } from "@/app/components/theme/ThemeProvider";
import Navbar from "@/app/components/layout/Navbar";
import Footer from "@/app/components/layout/Footer";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <WalletProvider>
        {/* <a href="#main-content" className="skip-link">
          Skip to content
        </a> */}
        <Navbar />
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8 scroll-mt-20"
        >
          {children}
        </main>
        <Footer />
      </WalletProvider>
    </ThemeProvider>
  );
}
