"use client";

import { CheckIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskStatus } from "@/lib/api/types";
import { useUpdateTask } from "@/lib/api/queries";
import { STATUSES } from "@/lib/task-meta";

type Props = {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

/** Row actions. Items are shown according to the per-task permissions the API returns. */
export function TaskActions({ task, onEdit, onDelete }: Props) {
  const update = useUpdateTask();
  const { can_edit, can_delete } = task.permissions;

  if (!can_edit && !can_delete) {
    return <span className="sr-only">No actions available</span>;
  }

  function moveTo(status: TaskStatus) {
    update.mutate(
      { id: task.id, changes: { status } },
      {
        onSuccess: () =>
          toast.success(`Moved to ${STATUSES.find((s) => s.value === status)!.label}`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for “${task.title}”`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {can_edit && (
          <>
            <DropdownMenuItem onSelect={() => onEdit(task)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">Move to</DropdownMenuLabel>
            {STATUSES.map((status) => (
              <DropdownMenuItem
                key={status.value}
                disabled={status.value === task.status || update.isPending}
                onSelect={() => moveTo(status.value)}
              >
                {status.value === task.status ? (
                  <CheckIcon />
                ) : (
                  <span className={`ml-1 size-2 rounded-full ${status.dot}`} aria-hidden />
                )}
                {status.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {can_delete && (
          <>
            {can_edit && <DropdownMenuSeparator />}
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
