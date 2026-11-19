import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { UserMenu } from "@/components/layout/user-menu";

export function AppHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" aria-label="Sprint Tracker home">
          <Brand />
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
