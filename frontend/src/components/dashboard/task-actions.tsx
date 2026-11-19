"use client";

import { CheckIcon, LockIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="text-muted-foreground/60 inline-flex size-7 items-center justify-center"
            aria-label="Read-only: only the reporter, assignee or an admin can change this task"
          >
            <LockIcon className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Only the reporter, assignee or an admin can change this task</TooltipContent>
      </Tooltip>
    );
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
