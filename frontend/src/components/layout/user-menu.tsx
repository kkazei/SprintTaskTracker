"use client";

import { LogOutIcon, ShieldCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeMenuItems } from "@/components/layout/theme-menu-items";
import { UserAvatar } from "@/components/user-avatar";
import { useCurrentUser, useLogout } from "@/lib/api/auth";

export function UserMenu() {
  const { data: user, isPending } = useCurrentUser();
  const logout = useLogout();

  if (isPending || !user) {
    return <Skeleton className="h-8 w-36 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 rounded-full pr-3 pl-1">
          <UserAvatar user={user} />
          <span className="hidden text-sm font-medium sm:inline">{user.full_name}</span>
          {user.role === "admin" && (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Admin
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="truncate">{user.full_name}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <ShieldCheckIcon />
          Role: <span className="capitalize">{user.role}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
