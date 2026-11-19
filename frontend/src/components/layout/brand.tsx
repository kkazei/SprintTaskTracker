import { KanbanSquareIcon } from "lucide-react";

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
        <KanbanSquareIcon className="size-4" aria-hidden />
      </span>
      Sprint Tracker
    </span>
  );
}
