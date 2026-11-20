"use client";

import { useReducedMotion } from "motion/react";

import { NumberTicker } from "@/components/ui/number-ticker";

/**
 * A metric value that counts up when it first appears (and animates to new values when filters
 * change). Plain text when the user prefers reduced motion. Colour is inherited from the parent.
 */
export function MetricNumber({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <span className="tabular-nums">{value}</span>;
  return (
    <NumberTicker
      value={value}
      className="tracking-tight text-inherit dark:text-inherit"
    />
  );
}
