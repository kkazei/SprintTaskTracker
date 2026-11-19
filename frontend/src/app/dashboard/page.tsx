import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    // Filters are read from the URL (useSearchParams), which is request-time data.
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardView />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-8" aria-busy aria-label="Loading dashboard">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
