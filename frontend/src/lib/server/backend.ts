import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Server-side helpers for the backend-for-frontend (BFF) layer.
 *
 * The browser never sees the API's JWT: route handlers keep it in an httpOnly cookie and attach
 * it when forwarding requests to FastAPI. That keeps the token out of reach of injected scripts,
 * and lets the API stay a plain bearer-token service usable from Swagger or Postman.
 */

function apiBaseUrl(): string {
  // Read at request time so one Docker image works in every environment.
  return (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

export function errorEnvelope(status: number, code: string, message: string) {
  return Response.json(
    { success: false, data: null, meta: null, error: { code, message, details: null } },
    { status },
  );
}

/** Forward a request to the FastAPI service. Returns a 502 envelope if it is unreachable. */
export async function callBackend(
  path: string,
  init: { method: string; body?: string; token?: string; search?: string },
): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  try {
    return await fetch(`${apiBaseUrl()}/api/v1${path}${init.search ?? ""}`, {
      method: init.method,
      headers,
      body: init.body,
      cache: "no-store",
    });
  } catch {
    return errorEnvelope(502, "backend_unavailable", "The API is unreachable. Please try again.");
  }
}

function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return forwardedProto ? forwardedProto === "https" : new URL(request.url).protocol === "https:";
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSessionToken(request: Request, token: string, maxAgeSeconds: number) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax blocks the cookie on cross-site POST/PATCH/DELETE, the main CSRF vector.
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSessionToken() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Defence in depth against CSRF on state-changing requests: browsers always send `Origin` on
 * POST/PATCH/DELETE, so reject any that come from another site.
 */
export function isCrossSiteRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
