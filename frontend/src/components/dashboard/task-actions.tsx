"use client";

import { LockIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/lib/api/auth";
import { useUpdateTask } from "@/lib/api/queries";
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
/** Assign an unassigned task to the current user. The API refuses if someone got there first. */
function useClaim(task: Task) {
  const { data: me } = useCurrentUser();
  const update = useUpdateTask();
  const claim = () => {
    if (!me) return;
    update.mutate(
      { id: task.id, changes: { assignee_id: me.id } },
      {
        onSuccess: () => toast.success(`“${task.title}” is now assigned to you`),
        onError: (error) => toast.error(error.message),
      },
    );
  };
  return { claim, isPending: update.isPending, ready: !!me };
}

export function TaskActions({ task, onEdit, onDelete }: Props) {
  const { can_edit, can_delete, can_claim } = task.permissions;
  const { claim, isPending, ready } = useClaim(task);

  // Members can't edit someone else's task, but they can pick up unassigned work.
  if (!can_edit && can_claim) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        disabled={isPending || !ready}
        onClick={claim}
        aria-label={`Assign “${task.title}” to me`}
      >
        <UserPlusIcon />
        <span className="hidden lg:inline">Assign to me</span>
      </Button>
    );
  }

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
        {can_claim && (
          <DropdownMenuItem onSelect={claim} disabled={isPending || !ready}>
            <UserPlusIcon />
            Assign to me
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
