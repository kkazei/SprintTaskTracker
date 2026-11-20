import { BrandMark } from "@/components/layout/brand";

/** Minimal, centered auth layout: logo, then the form. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <BrandMark className="mb-8 size-9 rounded-xl" />
        {children}
      </div>
    </main>
  );
}
