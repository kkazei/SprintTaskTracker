"use client";

import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { RoleNotice } from "@/components/role-notice";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useRole } from "@/lib/api/auth";
import { useSprints, useTasks, useUsers } from "@/lib/api/queries";
import type { Task } from "@/lib/api/types";

import { DeleteTaskDialog } from "./delete-task-dialog";
import { Pagination } from "./pagination";
import { SummaryCards } from "./summary-cards";
import { TaskFilters } from "./task-filters";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskList } from "./task-list";
import { useTaskFilters } from "./use-task-filters";

export function DashboardView() {
  const { data: me } = useCurrentUser();
  const role = useRole();
  const { data: users = [] } = useUsers();
  const { data: sprints = [] } = useSprints();
  const { filters, setFilters, resetFilters, isFiltered, scope, listParams } = useTaskFilters(
    me?.id,
  );
  const tasks = useTasks(listParams);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(task: Task) {
    setEditing(task);
    setFormOpen(true);
  }

  const scopeLabel = describeScope(filters.assignee, filters.sprint, users, sprints);
  const meta = tasks.data?.meta;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          {/* Static text: the user's name streams in after hydration, so it lives in the header. */}
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Track your team&apos;s tasks and sprint progress.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon />
          New task
        </Button>
      </div>

      {role === "member" && (
        <RoleNotice>
          You&apos;re a <strong className="text-foreground font-medium">member</strong>: you can
          create tasks, edit tasks you reported or are assigned to, and delete tasks you
          reported. Admins can change any task and manage sprints and roles.
        </RoleNotice>
      )}

      <SummaryCards scope={scope} scopeLabel={scopeLabel} />

      <section aria-labelledby="tasks-heading" className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="tasks-heading" className="text-base font-semibold">
            Tasks
          </h2>
          {tasks.isFetching && !tasks.isPending && (
            <RefreshCwIcon className="text-muted-foreground size-4 animate-spin" aria-label="Refreshing" />
          )}
        </div>

        <TaskFilters
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
          isFiltered={isFiltered}
          users={users}
          sprints={sprints}
        />

        {tasks.isError ? (
          <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm">
            <span>Couldn&apos;t load tasks: {tasks.error.message}</span>
            <Button variant="outline" size="sm" onClick={() => tasks.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <TaskList
              tasks={tasks.data?.data ?? []}
              isLoading={tasks.isPending}
              isRefreshing={tasks.isPlaceholderData}
              emptyMessage={
                isFiltered
                  ? "No tasks match these filters. Try widening your search."
                  : "Create the first task to get started."
              }
              onEdit={openEdit}
              onDelete={setDeleting}
            />
            {meta && <Pagination meta={meta} onPageChange={(page) => setFilters({ page })} />}
          </>
        )}
      </section>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        users={users}
        sprints={sprints}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function describeScope(
  assignee: string,
  sprint: string,
  users: { id: number; full_name: string }[],
  sprints: { id: number; name: string }[],
): string {
  const who =
    assignee === "me"
      ? "your tasks"
      : assignee === "unassigned"
        ? "unassigned tasks"
        : assignee === "all"
          ? "all tasks"
          : `tasks for ${users.find((u) => String(u.id) === assignee)?.full_name ?? "this person"}`;
  const where =
    sprint === "all" ? "" : ` in ${sprints.find((s) => String(s.id) === sprint)?.name ?? "this sprint"}`;
  return who + where;
}
