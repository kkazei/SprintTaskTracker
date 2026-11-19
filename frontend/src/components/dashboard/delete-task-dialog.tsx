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
import type { Task } from "@/lib/api/types";
import { useDeleteTask } from "@/lib/api/queries";

export function DeleteTaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const remove = useDeleteTask();

  function confirm() {
    if (!task) return;
    remove.mutate(task.id, {
      onSuccess: () => {
        toast.success("Task deleted");
        onClose();
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <AlertDialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            “{task?.title}” will be permanently deleted. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault(); // keep the dialog open until the request finishes
              confirm();
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
