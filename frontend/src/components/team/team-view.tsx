"use client";

import { ShieldCheckIcon, UserIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { RoleNotice } from "@/components/role-notice";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { cn, initials } from "@/lib/utils";
import { formatDate } from "@/lib/task-meta";

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
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground text-sm">
          {users ? `${users.length} members · ${adminCount} admins` : "People on your workspace."}
        </p>
      </div>

      {role === "member" && (
        <RoleNotice>Only admins can change roles. Ask an admin if you need more access.</RoleNotice>
      )}
      {isAdmin && (
        <RoleNotice>
          Admins manage sprints, roles and every task. Members create tasks and change the ones
          they reported or are assigned to.
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
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
          <UsersIcon className="text-muted-foreground size-8" aria-hidden />
          <p className="font-medium">No team members yet</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
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
      <Avatar className="size-7">
        <AvatarFallback className="text-xs">{initials(user.full_name)}</AvatarFallback>
      </Avatar>
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
              toast.success(`${updated.full_name} is now ${updated.role === "admin" ? "an admin" : "a member"}`),
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
