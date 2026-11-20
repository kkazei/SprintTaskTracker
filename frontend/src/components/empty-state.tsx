import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Friendly placeholder for empty lists: icon on a faint dot texture, title, hint and action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed px-6 py-14 text-center">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <span className="bg-background text-muted-foreground grid size-12 place-items-center rounded-full border shadow-xs">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="grid gap-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
