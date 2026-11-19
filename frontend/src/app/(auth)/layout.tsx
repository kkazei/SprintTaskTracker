import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="bg-muted/40 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Brand />
      <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">{children}</div>
    </main>
  );
}
