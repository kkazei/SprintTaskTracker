import Link from "next/link";

import { BrandPanel } from "@/components/auth/brand-panel";
import { Brand } from "@/components/layout/brand";

/** Split-screen auth: the form on the left, a brand panel on large screens. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/login" className="w-fit" aria-label="Sprint Tracker">
          <Brand />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-muted-foreground text-center text-xs lg:text-left">
          Demo workspace · data may be reset at any time
        </p>
      </div>
      <div className="hidden p-3 lg:block">
        <BrandPanel />
      </div>
    </main>
  );
}
