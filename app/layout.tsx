import type { Metadata } from "next";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import Providers from "@/app/Providers";
import ClientLayout from "@/app/ClientLayout";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Prester",
    template: "%s | Prester",
  },
  description:
    "Decentralized freelance platform built on Initia with AI-powered dispute resolution",
  keywords: [
    "freelance",
    "decentralized",
    "web3",
    "blockchain",
    "AI",
    "disputes",
  ],
  authors: [{ name: "Prester Team" }],
  creator: "Prester",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://prester.io",
    title: "Prester - Decentralized Freelance Platform",
    description:
      "Decentralized freelance platform built on Initia with AI-powered dispute resolution",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prester",
    description:
      "Decentralized freelance platform built on Initia with AI-powered dispute resolution",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-black">
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
