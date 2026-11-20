const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today (local) until an ISO calendar date (YYYY-MM-DD); negative once past. */
export function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / DAY_MS);
}

/** "6 days left", "Ends today", "Ended 2d ago". */
export function daysLeftLabel(endDate: string): string {
  const days = daysUntil(endDate);
  if (days < 0) return `Ended ${-days}d ago`;
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
