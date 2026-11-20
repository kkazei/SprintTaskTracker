"use client";

import { ClipboardListIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Task } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { TaskActions } from "./task-actions";
import { AssigneeLabel, DueDate, PriorityBadge } from "./task-badges";
import { TaskStatusSelect } from "./task-status-select";

type Props = {
  tasks: Task[];
  isLoading: boolean;
  isRefreshing: boolean;
  emptyMessage: string;
  emptyAction?: ReactNode;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskList({
  tasks,
  isLoading,
  isRefreshing,
  emptyMessage,
  emptyAction,
  onEdit,
  onDelete,
}: Props) {
  if (isLoading) return <TaskListSkeleton />;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
        <ClipboardListIcon className="text-muted-foreground size-8" aria-hidden />
        <p className="font-medium">No tasks found</p>
        <p className="text-muted-foreground max-w-sm text-sm">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div
      className={cn("transition-opacity", isRefreshing && "opacity-60")}
      aria-busy={isRefreshing}
    >
      {/* Desktop: table */}
      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%] pl-4">Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="max-w-0 pl-4">
                  <button
                    type="button"
                    onClick={() => task.permissions.can_edit && onEdit(task)}
                    className={cn(
                      "block max-w-full truncate text-left font-medium",
                      task.permissions.can_edit && "hover:underline",
                    )}
                    disabled={!task.permissions.can_edit}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                  <span className="text-muted-foreground block truncate text-xs">
                    {task.sprint ? task.sprint.name : "Backlog"}
                    {task.reporter && ` · reported by ${task.reporter.full_name}`}
                  </span>
                </TableCell>
                <TableCell>
                  <TaskStatusSelect task={task} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell className="max-w-44">
                  <AssigneeLabel user={task.assignee} />
                </TableCell>
                <TableCell>
                  <DueDate task={task} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <TaskActions task={task} onEdit={onEdit} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <ul className="grid gap-2 md:hidden">
        {tasks.map((task) => (
          <li key={task.id} className="bg-card grid gap-2 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium break-words">{task.title}</p>
                <p className="text-muted-foreground text-xs">
                  {task.sprint ? task.sprint.name : "Backlog"}
                </p>
              </div>
              <TaskActions task={task} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <TaskStatusSelect task={task} />
              <PriorityBadge priority={task.priority} />
              <DueDate task={task} />
            </div>
            <AssigneeLabel user={task.assignee} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="grid gap-2" aria-busy aria-label="Loading tasks">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
