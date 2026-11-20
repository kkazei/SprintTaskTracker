import { cn } from "@/lib/utils";

/** The product mark: three columns of decreasing height, like a board burning down. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg shadow-sm",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
        <rect x="2" y="2.5" width="3" height="11" rx="1.5" />
        <rect x="6.5" y="2.5" width="3" height="7" rx="1.5" opacity=".8" />
        <rect x="11" y="2.5" width="3" height="4" rx="1.5" opacity=".6" />
      </svg>
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <BrandMark />
      Sprint Tracker
    </span>
  );
}
