import "server-only";

import { createHmac } from "node:crypto";

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

/**
 * The browser's address as seen by the hosting edge.
 *
 * Only read these headers when the server is behind an edge that overwrites them (Vercel sets
 * `VERCEL=1`; other trusted proxies can opt in with `CLIENT_IP_TRUST_PROXY=true`). A directly
 * reachable Next.js server would otherwise let a client choose its own rate-limit bucket.
 */
export function clientIpFromRequest(request: Request): string | undefined {
  const trustEdgeHeaders =
    process.env.VERCEL === "1" || process.env.CLIENT_IP_TRUST_PROXY === "true";
  if (!trustEdgeHeaders) return undefined;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

/**
 * Sign the client IP for the API, which refuses unsigned or stale assertions. Both sides must
 * share CLIENT_IP_SECRET; without it no assertion is sent and the API keys by proxy address.
 */
function clientIdentityHeaders(clientIp?: string): Record<string, string> {
  const secret = process.env.CLIENT_IP_SECRET;
  if (!secret || !clientIp) return {};

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${clientIp}:${timestamp}`)
    .digest("hex");
  return {
    "X-Client-IP": clientIp,
    "X-Client-IP-Timestamp": timestamp,
    "X-Client-IP-Signature": signature,
  };
}

/** Forward a request to the FastAPI service. Returns a 502 envelope if it is unreachable. */
export async function callBackend(
  path: string,
  init: { method: string; body?: string; token?: string; search?: string; clientIp?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...clientIdentityHeaders(init.clientIp),
  };
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
