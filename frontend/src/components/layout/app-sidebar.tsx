"use client";

import { CalendarRangeIcon, LayoutDashboardIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ActiveSprintCard } from "@/components/layout/active-sprint-card";
import { Brand } from "@/components/layout/brand";
import { NavUser } from "@/components/layout/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/sprints", label: "Sprints", icon: CalendarRangeIcon },
  { href: "/team", label: "Team", icon: UsersIcon },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  // On mobile the sidebar is a sheet; close it once a destination is picked.
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <Link
          href="/dashboard"
          onClick={closeOnMobile}
          className="rounded-md px-2 py-1.5"
          aria-label="Sprint Tracker home"
        >
          <Brand />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeOnMobile}
                        aria-current={active ? "page" : undefined}
                        className="data-[active=true]:[&>svg]:text-primary"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Current sprint</SidebarGroupLabel>
          <SidebarGroupContent>
            <ActiveSprintCard onNavigate={closeOnMobile} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
