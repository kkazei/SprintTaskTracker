import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

// Soft tints that read well in both themes; a user always gets the same one.
const TINTS = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
] as const;

const SIZES = {
  xs: { box: "size-6", text: "text-[10px]" },
  sm: { box: "size-7", text: "text-[11px]" },
  md: { box: "size-8", text: "text-xs" },
} as const;

export function UserAvatar({
  user,
  size = "sm",
  className,
}: {
  user: { id: number; full_name: string };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size].box, className)}>
      <AvatarFallback
        className={cn("font-semibold", SIZES[size].text, TINTS[user.id % TINTS.length])}
      >
        {initials(user.full_name)}
      </AvatarFallback>
    </Avatar>
  );
}
