"use client";

import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskSummary } from "@/lib/api/types";
import { useTaskSummary, type SummaryScope } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { STATUSES } from "@/lib/task-meta";

import { MetricNumber } from "./metric-number";

type Metric = {
  label: string;
  value: (s: TaskSummary) => number;
  icon: LucideIcon;
  /** Tinted icon chip, so each metric is recognisable at a glance. */
  chip: string;
  tone?: (s: TaskSummary) => string | undefined;
  footnote: (s: TaskSummary) => string;
};

const METRICS: Metric[] = [
  {
    label: "Total tasks",
    value: (s) => s.total,
    icon: ListTodoIcon,
    chip: "bg-primary/10 text-primary",
    footnote: (s) => `${s.unassigned} unassigned`,
  },
  {
    label: "Completed",
    value: (s) => s.completed,
    icon: CheckCircle2Icon,
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    footnote: (s) => `${Math.round(s.completion_rate * 100)}% completion rate`,
  },
  {
    label: "Pending",
    value: (s) => s.pending,
    icon: CircleDashedIcon,
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    footnote: (s) => `${s.by_status.in_progress + s.by_status.in_review} in progress or review`,
  },
  {
    label: "Overdue",
    value: (s) => s.overdue,
    icon: AlertTriangleIcon,
    chip: "bg-red-500/10 text-red-600 dark:text-red-400",
    tone: (s) => (s.overdue > 0 ? "text-red-600 dark:text-red-400" : undefined),
    footnote: (s) => (s.overdue > 0 ? "Open and past due date" : "Nothing overdue"),
  },
  {
    label: "Due this week",
    value: (s) => s.due_soon,
    icon: CalendarClockIcon,
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    footnote: () => "Open, due in the next 7 days",
  },
];

export function SummaryCards({
  scope,
  scopeLabel,
  enabled = true,
}: {
  scope: SummaryScope;
  scopeLabel: string;
  enabled?: boolean;
}) {
  const { data: summary, isPending, isError } = useTaskSummary(scope, { enabled });

  return (
    <section aria-labelledby="overview-heading" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="overview-heading" className="text-base font-semibold">
          Overview
        </h2>
        <p className="text-muted-foreground text-xs">Showing {scopeLabel}</p>
      </div>

      {isError ? (
        <p className="text-destructive text-sm">Couldn&apos;t load metrics.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {METRICS.map((metric) => (
              <Card key={metric.label} size="sm" className="transition-shadow hover:shadow-md">
                <CardContent className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-sm font-medium">
                      {metric.label}
                    </span>
                    <span
                      className={cn("grid size-8 place-items-center rounded-lg", metric.chip)}
                      aria-hidden
                    >
                      <metric.icon className="size-4" />
                    </span>
                  </div>
                  <div className="grid gap-0.5">
                    {isPending || !summary ? (
                      <Skeleton className="h-8 w-14" />
                    ) : (
                      <span
                        className={cn(
                          "text-3xl leading-none font-semibold tracking-tight",
                          metric.tone?.(summary),
                        )}
                      >
                        <MetricNumber value={metric.value(summary)} />
                      </span>
                    )}
                    <span className="text-muted-foreground truncate pt-1 text-xs">
                      {summary ? metric.footnote(summary) : " "}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {summary && <StatusBreakdown summary={summary} />}
        </>
      )}
    </section>
  );
}

/** Completion and where the open work sits, as one stacked bar. */
function StatusBreakdown({ summary }: { summary: TaskSummary }) {
  const total = summary.total || 1;
  const percent = Math.round(summary.completion_rate * 100);
  // Done first, so the green segment reads as the completion bar.
  const ordered = [...STATUSES].reverse();
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-muted-foreground text-sm tabular-nums">
            <span className="text-foreground font-semibold">{percent}%</span> complete ·{" "}
            {summary.completed} of {summary.total} tasks
          </span>
        </div>
        <div
          className="bg-muted flex h-2.5 gap-0.5 overflow-hidden rounded-full"
          role="img"
          aria-label={`${percent}% complete. ${ordered.map((s) => `${s.label}: ${summary.by_status[s.value]}`).join(", ")}`}
        >
          {ordered.map((status) =>
            summary.by_status[status.value] ? (
              <div
                key={status.value}
                className={cn("h-full transition-all duration-500", status.bar)}
                style={{ width: `${(summary.by_status[status.value] / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {ordered.map((status) => (
            <li key={status.value} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", status.dot)} aria-hidden />
              {status.label}
              <span className="text-foreground font-medium tabular-nums">
                {summary.by_status[status.value]}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
