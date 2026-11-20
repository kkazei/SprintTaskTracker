"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useCurrentUser, useHydrated, useRole } from "@/lib/api/auth";
import type { TaskPriority, TaskStatus } from "@/lib/api/types";
import type { SummaryScope, TaskListParams } from "@/lib/api/queries";

/**
 * Dashboard filters live in the URL, so a filtered view can be bookmarked, shared or restored
 * with the back button. When the URL doesn't name a view, the last view the user picked is used,
 * falling back to a role default: members start on their own work, admins on the whole team.
 */
export type TaskView = "mine" | "reported" | "all";
export type DueFilter = "any" | "overdue" | "soon";

export type TaskFilterState = {
  /** null = not in the URL; resolved to a remembered or role-based default. */
  view: TaskView | null;
  q: string;
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  /** Only used in the "all" view: a user id, "unassigned" or "all". */
  assignee: string;
  /** A sprint id or "all". */
  sprint: string;
  due: DueFilter;
  /** null = the view's default sort. */
  sort: string | null;
  page: number;
};

const DEFAULTS: TaskFilterState = {
  view: null,
  q: "",
  status: "all",
  priority: "all",
  assignee: "all",
  sprint: "all",
  due: "any",
  sort: null,
  page: 1,
};

export const PAGE_SIZE = 10;
const VIEW_STORAGE_KEY = "tt:dashboard-view";
const VIEWS: TaskView[] = ["mine", "reported", "all"];

function readStoredView(): TaskView | null {
  try {
    const value = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.includes(value as TaskView) ? (value as TaskView) : null;
  } catch {
    return null; // storage blocked (private mode, disabled cookies)
  }
}

function storeView(view: TaskView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Remembering the view is a convenience; ignore storage failures.
  }
}

export const defaultSortFor = (view: TaskView) => (view === "all" ? "-created_at" : "urgency");

export function useTaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const role = useRole();
  const { data: me } = useCurrentUser();
  const meId = hydrated ? me?.id : undefined;

  const filters = useMemo<TaskFilterState>(() => {
    const view = searchParams.get("view");
    const due = searchParams.get("due");
    return {
      view: VIEWS.includes(view as TaskView) ? (view as TaskView) : null,
      q: searchParams.get("q") ?? DEFAULTS.q,
      status: (searchParams.get("status") as TaskFilterState["status"]) ?? DEFAULTS.status,
      priority: (searchParams.get("priority") as TaskFilterState["priority"]) ?? DEFAULTS.priority,
      assignee: searchParams.get("assignee") ?? DEFAULTS.assignee,
      sprint: searchParams.get("sprint") ?? DEFAULTS.sprint,
      due: due === "overdue" || due === "soon" ? due : "any",
      sort: searchParams.get("sort"),
      page: Math.max(1, Number(searchParams.get("page")) || 1),
    };
  }, [searchParams]);

  // Resolve the view: URL → remembered choice → role default. Unknown until hydrated.
  const view: TaskView | undefined =
    filters.view ??
    (hydrated ? readStoredView() : null) ??
    (role === "member" ? "mine" : role === "admin" ? "all" : undefined);
  const sort = filters.sort ?? (view ? defaultSortFor(view) : "-created_at");
  // Personal views need the current user's id before they can query.
  const ready = view !== undefined && (view === "all" || meId !== undefined);

  const setFilters = useCallback(
    (changes: Partial<TaskFilterState>) => {
      // Any filter change returns to page 1; only an explicit page change keeps the page.
      const next: TaskFilterState = { ...filters, view: view ?? null, page: 1, ...changes };
      if (changes.view) {
        storeView(changes.view);
        // The assignee filter only applies to the team-wide view; each view has its own default sort.
        next.assignee = "all";
        if (!("sort" in changes)) next.sort = null;
      }
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === DEFAULTS[key as keyof TaskFilterState] || value === "") {
          continue;
        }
        params.set(key, String(value));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [filters, view, pathname, router],
  );

  const resetFilters = useCallback(
    () => router.replace(view ? `${pathname}?view=${view}` : pathname, { scroll: false }),
    [view, pathname, router],
  );

  const isFiltered = (["q", "status", "priority", "assignee", "sprint", "due"] as const).some(
    (key) => filters[key] !== DEFAULTS[key],
  );

  const scope = useMemo<SummaryScope>(() => {
    const result: SummaryScope = {};
    if (view === "mine") result.assignee_id = meId;
    else if (view === "reported") result.reporter_id = meId;
    else if (filters.assignee === "unassigned") result.unassigned = true;
    else if (/^\d+$/.test(filters.assignee)) result.assignee_id = Number(filters.assignee);
    if (/^\d+$/.test(filters.sprint)) result.sprint_id = Number(filters.sprint);
    return result;
  }, [view, meId, filters.assignee, filters.sprint]);

  const listParams = useMemo<TaskListParams>(
    () => ({
      ...scope,
      q: filters.q || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      priority: filters.priority === "all" ? undefined : filters.priority,
      overdue: filters.due === "overdue" || undefined,
      due_soon: filters.due === "soon" || undefined,
      sort,
      page: filters.page,
      page_size: PAGE_SIZE,
    }),
    [filters, scope, sort],
  );

  return { filters, view, sort, ready, setFilters, resetFilters, isFiltered, scope, listParams };
}
