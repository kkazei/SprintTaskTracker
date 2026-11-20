"use client";

import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { Task, TaskStatus } from "@/lib/api/types";
import { useUpdateTask } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { STATUSES, statusMeta } from "@/lib/task-meta";

import { StatusBadge } from "./task-badges";

/**
 * Status shown as a one-click dropdown on tasks the user may edit, and as a plain label
 * otherwise. Updating a task's progress is the most frequent action, so it lives in the row.
 */
export function TaskStatusSelect({ task }: { task: Task }) {
  const update = useUpdateTask();

  if (!task.permissions.can_edit) return <StatusBadge status={task.status} />;

  function change(status: TaskStatus) {
    update.mutate(
      { id: task.id, changes: { status } },
      {
        onSuccess: () => toast.success(`“${task.title}” moved to ${statusMeta(status).label}`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const current = statusMeta(task.status);
  return (
    <Select value={task.status} onValueChange={(value) => change(value as TaskStatus)}>
      <SelectTrigger
        size="sm"
        disabled={update.isPending}
        aria-label={`Status of “${task.title}”: ${current.label}. Change status`}
        className="hover:bg-muted -ml-2 h-7 w-fit gap-1.5 border-transparent pr-1.5 pl-2 shadow-none dark:bg-transparent"
      >
        <span className={cn("size-2 rounded-full", current.dot)} aria-hidden />
        <span className="text-sm">{current.label}</span>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <span className={cn("size-2 rounded-full", status.dot)} aria-hidden />
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
