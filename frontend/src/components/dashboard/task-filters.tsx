"use client";

import { AlertTriangleIcon, CalendarClockIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Sprint, User } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { PRIORITIES, SORT_OPTIONS, STATUSES } from "@/lib/task-meta";

import type { DueFilter, TaskFilterState, TaskView } from "./use-task-filters";

type Props = {
  filters: TaskFilterState;
  view: TaskView | undefined;
  sort: string;
  onChange: (changes: Partial<TaskFilterState>) => void;
  onReset: () => void;
  isFiltered: boolean;
  users: User[];
  sprints: Sprint[];
};

const VIEW_TABS: { value: TaskView; label: string }[] = [
  { value: "mine", label: "My tasks" },
  { value: "reported", label: "Reported by me" },
  { value: "all", label: "All tasks" },
];

const DUE_CHIPS: { value: Exclude<DueFilter, "any">; label: string; icon: ReactNode }[] = [
  { value: "overdue", label: "Overdue", icon: <AlertTriangleIcon /> },
  { value: "soon", label: "Due this week", icon: <CalendarClockIcon /> },
];

const SEARCH_DEBOUNCE_MS = 300;

export function TaskFilters({
  filters,
  view,
  sort,
  onChange,
  onReset,
  isFiltered,
  users,
  sprints,
}: Props) {
  const [search, setSearch] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);

  // Keep the box in sync when the URL changes elsewhere (reset, back button).
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setSearch(filters.q);
  }

  // Debounce typing so each keystroke doesn't trigger a request.
  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => onChange({ q: search.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filters.q, onChange]);

  return (
    <div className="grid gap-3">
      {/* Whose tasks: the most common switch, so it's one click. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {view ? (
          <div
            role="tablist"
            aria-label="Whose tasks"
            className="bg-muted inline-flex rounded-lg p-0.5"
          >
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={view === tab.value}
                onClick={() => view !== tab.value && onChange({ view: tab.value })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  view === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <Skeleton className="h-9 w-72 rounded-lg" />
        )}

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Due date">
          {DUE_CHIPS.map((chip) => {
            const active = filters.due === chip.value;
            return (
              <Button
                key={chip.value}
                variant={active ? "secondary" : "outline"}
                size="sm"
                aria-pressed={active}
                onClick={() => onChange({ due: active ? "any" : chip.value })}
                className={cn(
                  active && chip.value === "overdue" && "bg-destructive/10 text-destructive",
                )}
              >
                {chip.icon}
                {chip.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div role="search" aria-label="Filter tasks" className="grid gap-3">
        <div className="relative">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search task titles…"
            aria-label="Search task titles"
            className="h-9 pl-8"
            maxLength={100}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            label="Status"
            value={filters.status}
            onValueChange={(status) => onChange({ status: status as TaskFilterState["status"] })}
            options={[{ value: "all", label: "All statuses" }, ...STATUSES]}
          />
          <FilterSelect
            label="Priority"
            value={filters.priority}
            onValueChange={(priority) =>
              onChange({ priority: priority as TaskFilterState["priority"] })
            }
            options={[{ value: "all", label: "All priorities" }, ...PRIORITIES]}
          />

          {view === "all" && (
            <Select value={filters.assignee} onValueChange={(assignee) => onChange({ assignee })}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any assignee</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.length > 0 && <SelectSeparator />}
                <SelectGroup>
                  {users.length > 0 && <SelectLabel>Team</SelectLabel>}
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          <FilterSelect
            label="Sprint"
            value={filters.sprint}
            onValueChange={(sprint) => onChange({ sprint })}
            className="sm:w-52"
            options={[
              { value: "all", label: "All sprints" },
              ...sprints.map((sprint) => ({
                value: String(sprint.id),
                label: sprint.status === "active" ? `${sprint.name} (active)` : sprint.name,
              })),
            ]}
          />

          <FilterSelect
            label="Sort"
            value={sort}
            onValueChange={(value) => onChange({ sort: value, page: filters.page })}
            className="sm:w-44"
            options={[...SORT_OPTIONS]}
          />

          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={onReset} className="justify-self-start">
              <XIcon />
              Clear filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  className = "sm:w-40",
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`w-full ${className}`} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
