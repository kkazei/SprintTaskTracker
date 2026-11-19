"use client";

import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskSummary } from "@/lib/api/types";
import { useTaskSummary, type SummaryScope } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { STATUSES } from "@/lib/task-meta";

type Metric = {
  label: string;
  value: (s: TaskSummary) => number;
  icon: LucideIcon;
  tone?: (s: TaskSummary) => string | undefined;
  footnote: (s: TaskSummary) => string;
};

const METRICS: Metric[] = [
  {
    label: "Total tasks",
    value: (s) => s.total,
    icon: ListTodoIcon,
    footnote: (s) => `${s.unassigned} unassigned`,
  },
  {
    label: "Completed",
    value: (s) => s.completed,
    icon: CheckCircle2Icon,
    tone: () => "text-emerald-600 dark:text-emerald-400",
    footnote: (s) => `${Math.round(s.completion_rate * 100)}% completion rate`,
  },
  {
    label: "Pending",
    value: (s) => s.pending,
    icon: CircleDashedIcon,
    footnote: (s) => `${s.by_status.in_progress + s.by_status.in_review} in progress or review`,
  },
  {
    label: "Overdue",
    value: (s) => s.overdue,
    icon: AlertTriangleIcon,
    tone: (s) => (s.overdue > 0 ? "text-destructive" : undefined),
    footnote: (s) => (s.overdue > 0 ? "Open and past due date" : "Nothing overdue"),
  },
  {
    label: "Due this week",
    value: (s) => s.due_soon,
    icon: CalendarClockIcon,
    footnote: () => "Open, due in the next 7 days",
  },
];

export function SummaryCards({ scope, scopeLabel }: { scope: SummaryScope; scopeLabel: string }) {
  const { data: summary, isPending, isError } = useTaskSummary(scope);

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
              <Card key={metric.label} size="sm" className="gap-1">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-muted-foreground text-xs font-medium">
                    {metric.label}
                  </CardTitle>
                  <metric.icon className="text-muted-foreground size-4" aria-hidden />
                </CardHeader>
                <CardContent className="grid gap-0.5">
                  {isPending || !summary ? (
                    <Skeleton className="h-7 w-12" />
                  ) : (
                    <span
                      className={cn(
                        "text-2xl font-semibold tabular-nums",
                        metric.tone?.(summary),
                      )}
                    >
                      {metric.value(summary)}
                    </span>
                  )}
                  <span className="text-muted-foreground truncate text-xs">
                    {summary ? metric.footnote(summary) : " "}
                  </span>
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

function StatusBreakdown({ summary }: { summary: TaskSummary }) {
  const total = summary.total || 1;
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">Completed vs. pending</span>
          <span className="text-muted-foreground tabular-nums">
            {summary.completed} / {summary.total} done
          </span>
        </div>
        <Progress
          value={summary.completion_rate * 100}
          aria-label={`${Math.round(summary.completion_rate * 100)}% of tasks completed`}
          className="h-2"
        />
        <div
          className="bg-muted flex h-2 overflow-hidden rounded-full"
          role="img"
          aria-label={STATUSES.map((s) => `${s.label}: ${summary.by_status[s.value]}`).join(", ")}
        >
          {STATUSES.map((status) => (
            <div
              key={status.value}
              className={cn("h-full transition-all", status.bar)}
              style={{ width: `${(summary.by_status[status.value] / total) * 100}%` }}
            />
          ))}
        </div>
        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STATUSES.map((status) => (
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
