"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white animate-fadeIn">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* ── Hero ──────────────────────────────────────────── */}
        <div className="mb-24 animate-slideDown">
          <div className="flex items-baseline gap-3 mb-8">
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest animate-pulse">
              Prester
            </span>
            <span className="text-neutral-300 animate-pulse">/</span>
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest animate-pulse">
              Decentralized Escrow
            </span>
          </div>
          <h1 className="text-7xl font-bold tracking-tight text-black mb-8 leading-tight animate-slideUp">
            Hire talent.
            <br />
            Pay with confidence.
          </h1>
          <p className="text-xl text-neutral-500 max-w-3xl mb-12 leading-relaxed animate-slideUp animation-delay-200">
            Post opportunities, lock payment in escrow, and let AI resolve
            disputes. No middlemen. No chargebacks. No excuses.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-6 animate-slideUp animation-delay-400">
            <Link
              href="/jobs"
              className="group inline-flex items-center gap-3 border border-black bg-black px-10 py-5 text-sm font-medium uppercase tracking-widest text-white transition-all hover:bg-white hover:text-black hover:shadow-xl animate-scaleIn"
              style={{ animationDelay: "500ms" }}
            >
              Browse Opportunities
              <svg
                className="h-5 w-5 transition-transform group-hover:translate-x-1 "
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-3 border border-black px-10 py-5 text-sm font-medium uppercase tracking-widest text-black transition-all hover:bg-black hover:text-white hover:shadow-xl animate-scaleIn"
              style={{ animationDelay: "600ms" }}
            >
              My Dashboard
              <svg
                className="h-5 w-5 transition-transform group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </Link>
          </div>
        </div>

        {/* ── How it works ──────────────────────────────────── */}
        <div className="mb-24 animate-fadeInUp animation-delay-800">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight text-black mb-4 animate-slideUp">
              How It Works
            </h2>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto leading-relaxed animate-slideUp animation-delay-200">
              Simple, transparent, and secure process from start to finish.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Post Opportunity",
                body: "Describe the work, set milestones, and lock total payment into escrow upfront.",
                icon: (
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "Work Gets Done",
                body: "Accept a bid, talent delivers milestone by milestone. You approve each one to release payment.",
                icon: (
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "AI Resolves Disputes",
                body: "If there's disagreement, an AI agent reviews both sides and issues a binding, on-chain verdict.",
                icon: (
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                ),
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="relative group animate-fadeInUp"
                style={{ animationDelay: `${1000 + i * 200}ms` }}
              >
                <div className="border border-black bg-white p-8 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-3xl font-bold text-neutral-100">
                        {item.step}
                      </span>
                      <div className="flex h-12 w-12 items-center justify-center border border-black bg-black transition-all group-hover:bg-white group-hover:text-black ">
                        {item.icon}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-base font-bold uppercase tracking-wide text-black mb-4">
                    {item.title}
                  </h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    {item.body}
                  </p>
                </div>
                {i < 2 && (
                  <div className="hidden sm:block absolute top-1/2 -right-4 w-8 h-px bg-black transform -translate-y-1/2 transition-all group-hover:scale-x-150 animate-slideIn" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────── */}
        <div
          className="border border-black bg-black p-12 text-center animate-fadeInUp"
          style={{ animationDelay: "1600ms" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { value: "$2.5M+", label: "Total Escrowed" },
              { value: "500+", label: "Opportunities Posted" },
              { value: "99.8%", label: "Dispute Resolution Rate" },
            ].map((stat, i) => (
              <div
                key={i}
                className="space-y-2 animate-scaleIn"
                style={{ animationDelay: `${1700 + i * 100}ms` }}
              >
                <div className="text-3xl font-bold text-white font-mono ">
                  {stat.value}
                </div>
                <div className="text-sm text-neutral-400 uppercase tracking-widest">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
