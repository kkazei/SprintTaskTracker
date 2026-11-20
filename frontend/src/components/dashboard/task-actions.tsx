"use client";

import { LockIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Task } from "@/lib/api/types";

type Props = {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

/**
 * Row actions, shown according to the per-task permissions the API returns.
 * Status changes live in the row itself (TaskStatusSelect), so this menu is Edit / Delete.
 */
export function TaskActions({ task, onEdit, onDelete }: Props) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for “${task.title}”`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {can_edit && (
          <DropdownMenuItem onSelect={() => onEdit(task)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
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
