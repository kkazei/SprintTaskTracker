"use client";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Sprint } from "@/lib/api/types";
import { useDeleteSprint } from "@/lib/api/queries";

export function DeleteSprintDialog({
  sprint,
  onClose,
}: {
  sprint: Sprint | null;
  onClose: () => void;
}) {
  const remove = useDeleteSprint();
  const taskCount = sprint?.task_count ?? 0;

  function confirm() {
    if (!sprint) return;
    remove.mutate(sprint.id, {
      onSuccess: () => {
        toast.success("Sprint deleted");
        onClose();
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <AlertDialog open={!!sprint} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{sprint?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {taskCount > 0
              ? `Its ${taskCount} ${taskCount === 1 ? "task" : "tasks"} will be kept and moved to the backlog.`
              : "This sprint has no tasks."}{" "}
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete sprint"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
