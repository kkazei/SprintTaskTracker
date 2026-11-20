"use client";

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";

import { ThemeMenuItems } from "@/components/layout/theme-menu-items";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useCurrentUser, useLogout } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

function RoleBadge({ role }: { role: "admin" | "member" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-px text-[10px] font-medium tracking-wide uppercase",
        role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {role}
    </span>
  );
}

/** Signed-in user in the sidebar footer: identity, role, theme and sign-out. */
export function NavUser() {
  const { data: user, isPending } = useCurrentUser();
  const logout = useLogout();
  const { isMobile } = useSidebar();

  // Fixed-size placeholder (SidebarMenuSkeleton picks a random width, which breaks hydration).
  if (isPending || !user) {
    return (
      <div className="flex h-12 items-center gap-2 px-2" aria-busy aria-label="Loading account">
        <Skeleton className="size-8 rounded-full" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
              aria-label={`Account menu for ${user.full_name}`}
            >
              <UserAvatar user={user} size="md" />
              <span className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{user.full_name}</span>
                  <RoleBadge role={user.role} />
                </span>
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              </span>
              <ChevronsUpDownIcon className="text-muted-foreground ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="w-60"
          >
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              <UserAvatar user={user} size="md" />
              <span className="grid min-w-0 leading-tight">
                <span className="truncate text-sm font-medium">{user.full_name}</span>
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeMenuItems />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
