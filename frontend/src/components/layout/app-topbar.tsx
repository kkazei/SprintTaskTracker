"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/layout/app-sidebar";
import { BrandMark } from "@/components/layout/brand";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/** Slim bar above page content: sidebar toggle and where you are (brand too on mobile). */
export function AppTopbar() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:rounded-t-xl md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Link href="/dashboard" className="md:hidden" aria-label="Sprint Tracker home">
        <BrandMark className="size-6" />
      </Link>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-1.5">
          <li className="text-muted-foreground hidden sm:block">Sprint Tracker</li>
          <li aria-hidden className="text-muted-foreground/60 hidden sm:block">
            /
          </li>
          <li className="font-medium" aria-current="page">
            {current?.label ?? "Workspace"}
          </li>
        </ol>
      </nav>
    </header>
  );
}
