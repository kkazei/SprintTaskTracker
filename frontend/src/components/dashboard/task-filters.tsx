"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import type { Sprint, User } from "@/lib/api/types";
import { PRIORITIES, SORT_OPTIONS, STATUSES } from "@/lib/task-meta";

import type { TaskFilterState } from "./use-task-filters";

type Props = {
  filters: TaskFilterState;
  onChange: (changes: Partial<TaskFilterState>) => void;
  onReset: () => void;
  isFiltered: boolean;
  users: User[];
  sprints: Sprint[];
};

const SEARCH_DEBOUNCE_MS = 300;

export function TaskFilters({ filters, onChange, onReset, isFiltered, users, sprints }: Props) {
  const overdueId = useId();
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
    <div className="grid gap-3" role="search" aria-label="Filter tasks">
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

        <Select value={filters.assignee} onValueChange={(assignee) => onChange({ assignee })}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
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
          value={filters.sort}
          onValueChange={(sort) => onChange({ sort, page: filters.page })}
          className="sm:w-44"
          options={[...SORT_OPTIONS]}
        />

        <div className="flex h-8 items-center gap-2 sm:px-2">
          <Switch
            id={overdueId}
            checked={filters.overdue}
            onCheckedChange={(overdue) => onChange({ overdue })}
          />
          <Label htmlFor={overdueId} className="text-sm font-normal">
            Overdue only
          </Label>
        </div>

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={onReset} className="justify-self-start">
            <XIcon />
            Clear filters
          </Button>
        )}
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
