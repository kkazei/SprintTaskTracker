import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/lib/api/client";

/**
 * Attach API validation errors (`error.details[].field`) to the matching form fields.
 * Returns the message to show as a form-level error when nothing could be mapped.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";

  let mapped = false;
  for (const detail of error.details) {
    const field = detail.field as Path<T>;
    if (fields.includes(field)) {
      setError(field, { type: "server", message: capitalize(detail.message) });
      mapped = true;
    }
  }
  return mapped ? null : error.message;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
