"use client";

import {
  ArrowRightIcon,
  CalendarRangeIcon,
  CheckCheckIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import type { Sprint, SprintStatus } from "@/lib/api/types";
import { useUpdateSprint } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { formatDate, sprintStatusMeta } from "@/lib/task-meta";

type Props = {
  sprint: Sprint;
  canManage: boolean;
  onEdit: (sprint: Sprint) => void;
  onDelete: (sprint: Sprint) => void;
};

export function SprintCard({ sprint, canManage, onEdit, onDelete }: Props) {
  const status = sprintStatusMeta(sprint.status);
  const percent = sprint.task_count
    ? Math.round((sprint.completed_task_count / sprint.task_count) * 100)
    : 0;

  return (
    <Card className={cn(sprint.status === "active" && "ring-emerald-500/40 ring-2")}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1.5">
          <span
            className={cn(
              "inline-flex h-5 w-fit items-center rounded-full px-2 text-xs font-medium",
              status.className,
            )}
          >
            {status.label}
          </span>
          <CardTitle className="truncate text-base" title={sprint.name}>
            {sprint.name}
          </CardTitle>
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <CalendarRangeIcon className="size-3.5" aria-hidden />
            {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}
          </p>
        </div>
        {canManage && <SprintActions sprint={sprint} onEdit={onEdit} onDelete={onDelete} />}
      </CardHeader>

      <CardContent className="grid flex-1 gap-3">
        <p className={cn("text-sm", !sprint.goal && "text-muted-foreground italic")}>
          {sprint.goal || "No goal set"}
        </p>
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="tabular-nums">
              {sprint.completed_task_count}/{sprint.task_count} tasks · {percent}%
            </span>
          </div>
          <Progress value={percent} className="h-1.5" aria-label={`${percent}% of tasks done`} />
        </div>
      </CardContent>

      <CardFooter>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/dashboard?sprint=${sprint.id}`}>
            View tasks
            <ArrowRightIcon />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function SprintActions({ sprint, onEdit, onDelete }: Omit<Props, "canManage">) {
  const update = useUpdateSprint();

  function setStatus(status: SprintStatus, message: string) {
    update.mutate(
      { id: sprint.id, changes: { status } },
      { onSuccess: () => toast.success(message), onError: (error) => toast.error(error.message) },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${sprint.name}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => onEdit(sprint)}>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        {sprint.status === "planned" && (
          <DropdownMenuItem
            disabled={update.isPending}
            onSelect={() => setStatus("active", "Sprint started")}
          >
            <PlayIcon />
            Start sprint
          </DropdownMenuItem>
        )}
        {sprint.status === "active" && (
          <DropdownMenuItem
            disabled={update.isPending}
            onSelect={() => setStatus("completed", "Sprint completed")}
          >
            <CheckCheckIcon />
            Complete sprint
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(sprint)}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
