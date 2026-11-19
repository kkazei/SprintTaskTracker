"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { TaskPriority, TaskStatus } from "@/lib/api/types";
import type { SummaryScope, TaskListParams } from "@/lib/api/queries";

/**
 * Dashboard filters live in the URL, so a filtered view can be bookmarked, shared or restored
 * with the back button.
 */
export type TaskFilterState = {
  q: string;
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  /** A user id, "me", "unassigned" or "all". */
  assignee: string;
  /** A sprint id or "all". */
  sprint: string;
  overdue: boolean;
  sort: string;
  page: number;
};

const DEFAULTS: TaskFilterState = {
  q: "",
  status: "all",
  priority: "all",
  assignee: "all",
  sprint: "all",
  overdue: false,
  sort: "-created_at",
  page: 1,
};

export const PAGE_SIZE = 10;

export function useTaskFilters(currentUserId: number | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<TaskFilterState>(
    () => ({
      q: searchParams.get("q") ?? DEFAULTS.q,
      status: (searchParams.get("status") as TaskFilterState["status"]) ?? DEFAULTS.status,
      priority: (searchParams.get("priority") as TaskFilterState["priority"]) ?? DEFAULTS.priority,
      assignee: searchParams.get("assignee") ?? DEFAULTS.assignee,
      sprint: searchParams.get("sprint") ?? DEFAULTS.sprint,
      overdue: searchParams.get("overdue") === "1",
      sort: searchParams.get("sort") ?? DEFAULTS.sort,
      page: Math.max(1, Number(searchParams.get("page")) || 1),
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (changes: Partial<TaskFilterState>) => {
      // Any filter change returns to page 1; only an explicit page change keeps the page.
      const next = { ...filters, page: 1, ...changes };
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        const isDefault = value === DEFAULTS[key as keyof TaskFilterState];
        if (isDefault || value === "" || value === false) continue;
        params.set(key, value === true ? "1" : String(value));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const resetFilters = useCallback(() => router.replace(pathname, { scroll: false }), [
    pathname,
    router,
  ]);

  const isFiltered = Object.entries(filters).some(
    ([key, value]) => key !== "page" && key !== "sort" && value !== DEFAULTS[key as keyof TaskFilterState],
  );

  const scope = useMemo<SummaryScope>(() => toScope(filters, currentUserId), [filters, currentUserId]);

  const listParams = useMemo<TaskListParams>(
    () => ({
      ...scope,
      q: filters.q || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      priority: filters.priority === "all" ? undefined : filters.priority,
      overdue: filters.overdue || undefined,
      sort: filters.sort,
      page: filters.page,
      page_size: PAGE_SIZE,
    }),
    [filters, scope],
  );

  return { filters, setFilters, resetFilters, isFiltered, scope, listParams };
}

/** Assignee and sprint define *whose* work we're looking at; metrics follow that scope. */
function toScope(filters: TaskFilterState, currentUserId: number | undefined): SummaryScope {
  const scope: SummaryScope = {};
  if (filters.assignee === "unassigned") scope.unassigned = true;
  else if (filters.assignee === "me" && currentUserId) scope.assignee_id = currentUserId;
  else if (/^\d+$/.test(filters.assignee)) scope.assignee_id = Number(filters.assignee);
  if (/^\d+$/.test(filters.sprint)) scope.sprint_id = Number(filters.sprint);
  return scope;
}
