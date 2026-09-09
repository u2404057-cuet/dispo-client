// This page is effectively unreachable in normal use — src/proxy.js
// intercepts every request to "/" and redirects based on the visitor's
// session/role before this ever renders. This fallback only shows up if
// that redirect somehow doesn't fire (e.g. proxy disabled in some
// deployment context), so it does the same redirect client-side as a
// safety net rather than showing a broken blank page.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface">
      <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>
    </main>
  );
}
