import type { Metadata } from "next";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import Providers from "@/app/providers";
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
  other: {
    "talentapp:project_verification":
      "06b17b1f3547e1c9b67828ddd354b54c6faed95183e028a78ded92bb3a3060dfe81803443dcf95ce1de4144d06a3526c7a608d0de108462612023753b9a51849",
  },
};

// Runs before React hydrates — prevents a flash of wrong theme.
const themeInitScript = `
(function(){try{
  var s=localStorage.getItem('theme');
  var d=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var r=(s==='dark'||s==='light')?s:(d?'dark':'light');
  document.documentElement.setAttribute('data-theme',r);
}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
