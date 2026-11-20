import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/** Shared chrome for signed-in pages (dashboard, sprints, team). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppTopbar />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
