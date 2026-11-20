"use client";

import { ShieldCheckIcon, UserIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RoleNotice } from "@/components/role-notice";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser, useHydrated, useRole } from "@/lib/api/auth";
import { useChangeRole, useUsers } from "@/lib/api/queries";
import type { User, UserRole } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/task-meta";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function TeamView() {
  const role = useRole();
  const { data: me } = useCurrentUser();
  const hydrated = useHydrated();
  const meId = hydrated ? me?.id : undefined;
  const { data: users, isPending, isError, refetch } = useUsers();
  const isAdmin = role === "admin";
  const adminCount = users?.filter((u) => u.role === "admin").length ?? 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Team"
        description={
          users
            ? `${plural(users.length, "member")} · ${plural(adminCount, "admin")}`
            : "People in your workspace."
        }
      />

      {role === "member" && (
        <RoleNotice>Only admins can change roles. Ask an admin if you need more access.</RoleNotice>
      )}
      {isAdmin && (
        <RoleNotice>
          Admins manage sprints, roles and every task. Members create tasks and change the ones they
          reported or are assigned to.
        </RoleNotice>
      )}

      {isError ? (
        <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm">
          <span>Couldn&apos;t load the team.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <div className="grid gap-2" aria-busy aria-label="Loading team">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No team members yet" />
      ) : (
        <>
          {/* Desktop */}
          <div className="bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 [&>th]:text-muted-foreground [&>th]:h-10 [&>th]:text-xs [&>th]:font-medium">
                  <TableHead className="pl-4">Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-44 pr-4">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="pl-4">
                      <MemberName user={user} isMe={user.id === meId} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <RoleControl user={user} canEdit={isAdmin} isMe={user.id === meId} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <ul className="grid gap-2 md:hidden">
            {users.map((user) => (
              <li
                key={user.id}
                className="bg-card flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="grid min-w-0 gap-0.5">
                  <MemberName user={user} isMe={user.id === meId} />
                  <span className="text-muted-foreground truncate pl-9 text-xs">{user.email}</span>
                </div>
                <RoleControl user={user} canEdit={isAdmin} isMe={user.id === meId} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MemberName({ user, isMe }: { user: User; isMe: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar user={user} />
      <span className="truncate font-medium">{user.full_name}</span>
      {isMe && <span className="text-muted-foreground text-xs">(you)</span>}
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const Icon = role === "admin" ? ShieldCheckIcon : UserIcon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium capitalize",
        role === "admin"
          ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {role}
    </span>
  );
}

function RoleControl({ user, canEdit, isMe }: { user: User; canEdit: boolean; isMe: boolean }) {
  const changeRole = useChangeRole();

  if (!canEdit) return <RoleBadge role={user.role} />;

  if (isMe) {
    // Mirrors the API rule: admins can't demote themselves (avoids locking everyone out).
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <RoleBadge role={user.role} />
          </span>
        </TooltipTrigger>
        <TooltipContent>You can&apos;t change your own role</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Select
      value={user.role}
      disabled={changeRole.isPending}
      onValueChange={(role) =>
        changeRole.mutate(
          { id: user.id, role: role as UserRole },
          {
            onSuccess: (updated) =>
              toast.success(
                `${updated.full_name} is now ${updated.role === "admin" ? "an admin" : "a member"}`,
              ),
            onError: (error) => toast.error(error.message),
          },
        )
      }
    >
      <SelectTrigger className="w-32" aria-label={`Role for ${user.full_name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">Member</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
