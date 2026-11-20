"use client";

import { CalendarRangeIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { RoleNotice } from "@/components/role-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/lib/api/auth";
import { useSprints } from "@/lib/api/queries";
import type { Sprint, SprintStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { SPRINT_STATUSES } from "@/lib/task-meta";

import { DeleteSprintDialog } from "./delete-sprint-dialog";
import { SprintCard } from "./sprint-card";
import { SprintFormDialog } from "./sprint-form-dialog";

type Tab = SprintStatus | "all";
const TABS: { value: Tab; label: string }[] = [{ value: "all", label: "All" }, ...SPRINT_STATUSES];
// Active first, then upcoming, then history.
const STATUS_ORDER: Record<SprintStatus, number> = { active: 0, planned: 1, completed: 2 };

export function SprintsView() {
  const role = useRole();
  const isAdmin = role === "admin";
  const { data: sprints, isPending, isError, refetch } = useSprints();

  const [tab, setTab] = useState<Tab>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sprint | null>(null);
  const [deleting, setDeleting] = useState<Sprint | null>(null);

  const visible = (sprints ?? [])
    .filter((sprint) => tab === "all" || sprint.status === tab)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.start_date.localeCompare(a.start_date),
    );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(sprint: Sprint) {
    setEditing(sprint);
    setFormOpen(true);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sprints"
        description="Plan iterations and track their progress."
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <PlusIcon />
              New sprint
            </Button>
          )
        }
      />

      {role === "member" && (
        <RoleNotice>
          Only admins can create, start, complete or delete sprints. You can view progress and
          open a sprint&apos;s tasks.
        </RoleNotice>
      )}

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
        {TABS.map((item) => {
          const count = item.value === "all"
            ? sprints?.length
            : sprints?.filter((s) => s.status === item.value).length;
          return (
            <Button
              key={item.value}
              variant={tab === item.value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={tab === item.value}
              onClick={() => setTab(item.value)}
            >
              {item.label}
              {count !== undefined && (
                <span className="text-muted-foreground tabular-nums">{count}</span>
              )}
            </Button>
          );
        })}
      </div>

      {isError ? (
        <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm">
          <span>Couldn&apos;t load sprints.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy aria-label="Loading sprints">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
          <CalendarRangeIcon className="text-muted-foreground size-8" aria-hidden />
          <p className="font-medium">No sprints here</p>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Create a sprint to start planning." : "An admin hasn't created one yet."}
          </p>
        </div>
      ) : (
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
          {visible.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              canManage={isAdmin}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <SprintFormDialog open={formOpen} onOpenChange={setFormOpen} sprint={editing} />
          <DeleteSprintDialog sprint={deleting} onClose={() => setDeleting(null)} />
        </>
      )}
    </div>
  );
}
