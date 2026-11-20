import { CalendarIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import type { Task, TaskPriority, TaskStatus, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatDate, priorityMeta, statusMeta } from "@/lib/task-meta";

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = statusMeta(status);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = priorityMeta(priority);
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function AssigneeLabel({ user }: { user: UserSummary | null }) {
  if (!user) return <span className="text-muted-foreground text-sm">Unassigned</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <UserAvatar user={user} size="xs" />
      <span className="truncate">{user.full_name}</span>
    </span>
  );
}

export function DueDate({ task }: { task: Pick<Task, "due_date" | "is_overdue"> }) {
  if (!task.due_date) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm whitespace-nowrap",
        task.is_overdue && "text-destructive font-medium",
      )}
    >
      <CalendarIcon className="size-3.5" aria-hidden />
      {formatDate(task.due_date)}
      {task.is_overdue && <span className="sr-only">(overdue)</span>}
    </span>
  );
}
