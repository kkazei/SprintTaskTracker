import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A quiet one-line explanation of what the current role can do on a page. */
export function RoleNotice({ children }: { children: ReactNode }) {
  return (
    <p className="bg-muted/60 text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
