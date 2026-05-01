import { Suspense } from "react";
import InboxClient from "./_components/InboxClient";

export const metadata = {
  title: "Messages — Prester",
};

export default function MessagesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<InboxFallback />}>
        <InboxClient />
      </Suspense>
    </div>
  );
}

function InboxFallback() {
  return (
    <div className="flex h-[70vh] items-center justify-center text-sm text-muted">
      Loading messages…
    </div>
  );
}
