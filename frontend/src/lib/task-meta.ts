import type { SprintStatus, TaskPriority, TaskStatus } from "@/lib/api/types";

export const STATUSES: { value: TaskStatus; label: string; dot: string; bar: string }[] = [
  { value: "todo", label: "To do", dot: "bg-slate-400", bar: "bg-slate-400" },
  { value: "in_progress", label: "In progress", dot: "bg-blue-500", bar: "bg-blue-500" },
  { value: "in_review", label: "In review", dot: "bg-amber-500", bar: "bg-amber-500" },
  { value: "done", label: "Done", dot: "bg-emerald-500", bar: "bg-emerald-500" },
];

export const PRIORITIES: { value: TaskPriority; label: string; className: string }[] = [
  { value: "low", label: "Low", className: "bg-muted text-muted-foreground" },
  {
    value: "medium",
    label: "Medium",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  {
    value: "high",
    label: "High",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  },
  {
    value: "urgent",
    label: "Urgent",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
];

export const SPRINT_STATUSES: { value: SprintStatus; label: string; className: string }[] = [
  {
    value: "active",
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  {
    value: "planned",
    label: "Planned",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  { value: "completed", label: "Completed", className: "bg-muted text-muted-foreground" },
];

export const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "-updated_at", label: "Recently updated" },
  { value: "due_date", label: "Due date (soonest)" },
  { value: "-priority", label: "Priority (highest)" },
  { value: "title", label: "Title (A–Z)" },
] as const;

export const statusMeta = (status: TaskStatus) => STATUSES.find((s) => s.value === status)!;
export const sprintStatusMeta = (status: SprintStatus) =>
  SPRINT_STATUSES.find((s) => s.value === status)!;
export const priorityMeta = (priority: TaskPriority) =>
  PRIORITIES.find((p) => p.value === priority)!;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC", // due dates are calendar dates (YYYY-MM-DD); don't shift them by timezone
});

export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}
