import type { ApiEnvelope, FieldError, PageMeta } from "@/lib/api/types";

/** An error returned by the API in the standard envelope (or a network failure). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

function toQueryString(params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Call a same-origin route (the BFF) and unwrap the `{success, data, meta, error}` envelope. */
export async function request<T>(
  path: string,
  { method = "GET", body, params, signal }: RequestOptions = {},
): Promise<{ data: T; meta: PageMeta | null }> {
  let response: Response;
  try {
    response = await fetch(path + toQueryString(params), {
      method,
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Network error. Check your connection and try again.", 0, "network_error");
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. a proxy error page); handled below.
  }

  if (!response.ok || !payload?.success) {
    const error = payload?.error;
    throw new ApiError(
      error?.message ?? `Request failed (${response.status})`,
      response.status,
      error?.code ?? "unknown_error",
      error?.details ?? [],
    );
  }
  return { data: payload.data, meta: payload.meta };
}
