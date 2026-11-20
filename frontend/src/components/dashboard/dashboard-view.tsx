"use client";

import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { RoleNotice } from "@/components/role-notice";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/api/auth";
import { useSprints, useTasks, useUsers } from "@/lib/api/queries";
import type { Sprint, Task, User } from "@/lib/api/types";

import { DeleteTaskDialog } from "./delete-task-dialog";
import { Pagination } from "./pagination";
import { SummaryCards } from "./summary-cards";
import { TaskFilters } from "./task-filters";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskList } from "./task-list";
import { useTaskFilters, type TaskFilterState, type TaskView } from "./use-task-filters";

export function DashboardView() {
  const role = useRole();
  const { data: users = [] } = useUsers();
  const { data: sprints = [] } = useSprints();
  const { filters, view, sort, ready, setFilters, resetFilters, isFiltered, scope, listParams } =
    useTaskFilters();
  // Wait until the view (and, for personal views, the user's id) is known, so the first
  // request is the right one instead of "all tasks" followed by "my tasks".
  const tasks = useTasks(listParams, { enabled: ready });

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

  const meta = tasks.data?.meta;

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Dashboard"
        description="Track your team's tasks and sprint progress."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon />
            New task
          </Button>
        }
      />

      {role === "member" && (
        <RoleNotice>
          You&apos;re a <strong className="text-foreground font-medium">member</strong>: you can
          create tasks, update tasks you reported or are assigned to, and delete tasks you
          reported. Admins can change any task and manage sprints and roles.
        </RoleNotice>
      )}

      <SummaryCards
        scope={scope}
        scopeLabel={describeScope(view, filters, users, sprints)}
        enabled={ready}
      />

      <section aria-labelledby="tasks-heading" className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="tasks-heading" className="text-base font-semibold">
            Tasks
          </h2>
          {tasks.isFetching && !tasks.isPending && (
            <RefreshCwIcon
              className="text-muted-foreground size-4 animate-spin"
              aria-label="Refreshing"
            />
          )}
        </div>

        <TaskFilters
          filters={filters}
          view={view}
          sort={sort}
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
              emptyMessage={emptyMessage(view, isFiltered)}
              emptyAction={
                view !== "all" && !isFiltered ? (
                  <Button variant="outline" size="sm" onClick={() => setFilters({ view: "all" })}>
                    Browse all tasks
                  </Button>
                ) : undefined
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

function emptyMessage(view: TaskView | undefined, isFiltered: boolean): string {
  if (isFiltered) return "No tasks match these filters. Try widening your search.";
  if (view === "mine") return "Nothing is assigned to you right now.";
  if (view === "reported") return "You haven't created any tasks yet.";
  return "Create the first task to get started.";
}

function describeScope(
  view: TaskView | undefined,
  filters: TaskFilterState,
  users: User[],
  sprints: Sprint[],
): string {
  const who =
    view === "mine"
      ? "tasks assigned to you"
      : view === "reported"
        ? "tasks you reported"
        : filters.assignee === "unassigned"
          ? "unassigned tasks"
          : filters.assignee === "all"
            ? "all tasks"
            : `tasks for ${users.find((u) => String(u.id) === filters.assignee)?.full_name ?? "this person"}`;
  const where =
    filters.sprint === "all"
      ? ""
      : ` in ${sprints.find((s) => String(s.id) === filters.sprint)?.name ?? "this sprint"}`;
  return who + where;
}
