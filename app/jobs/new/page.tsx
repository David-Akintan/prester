"use client";

import { CreateJobForm } from "@/app/jobs/CreateJobForm";

export default function NewJobPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
              Create
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-black mb-3">
            Post Opportunity
          </h1>
          <p className="text-base text-neutral-500 max-w-2xl">
            Describe your project and set milestone payments. Funds are held in
            escrow until work is approved and delivered successfully.
          </p>
        </div>

        <CreateJobForm />
      </div>
    </div>
  );
}
