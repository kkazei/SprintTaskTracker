"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/lib/api/auth";
import { useSprints } from "@/lib/api/queries";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today (local) until an ISO calendar date; negative once it has passed. */
function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - today.getTime()) / DAY_MS);
}

function daysLeftLabel(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days < 0) return `Ended ${-days}d ago`;
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export function ActiveSprintCard({ onNavigate }: { onNavigate?: () => void }) {
  const { data: sprints, isPending } = useSprints();
  const role = useRole();

  if (isPending) return <Skeleton className="h-24 rounded-lg" />;

  const active = sprints?.find((sprint) => sprint.status === "active");
  if (!active) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
        No active sprint.{" "}
        {role === "admin" && (
          <Link href="/sprints" onClick={onNavigate} className="text-primary font-medium hover:underline">
            Start one
          </Link>
        )}
      </div>
    );
  }

  const percent = active.task_count
    ? Math.round((active.completed_task_count / active.task_count) * 100)
    : 0;

  return (
    <Link
      href={`/dashboard?view=all&sprint=${active.id}`}
      onClick={onNavigate}
      className="group bg-background hover:border-primary/40 grid gap-2 rounded-lg border p-3 shadow-xs transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{active.name}</span>
        <ArrowRightIcon className="text-muted-foreground group-hover:text-primary mt-0.5 size-3.5 shrink-0 transition-colors" />
      </div>
      <Progress value={percent} className="h-1.5" aria-label={`${percent}% of sprint tasks done`} />
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>
          {active.completed_task_count}/{active.task_count} done
        </span>
        <span>{daysLeftLabel(active.end_date)}</span>
      </div>
    </Link>
  );
}
