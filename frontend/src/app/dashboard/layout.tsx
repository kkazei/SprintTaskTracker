import { AppHeader } from "@/components/layout/app-header";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}
