import type { NextRequest } from "next/server";

import {
  callBackend,
  clearSessionToken,
  clientIpFromRequest,
  errorEnvelope,
  getSessionToken,
  isCrossSiteRequest,
} from "@/lib/server/backend";

/**
 * Authenticated pass-through to the FastAPI service: /api/backend/<path> → API_URL/api/v1/<path>.
 *
 * Only known resources are forwarded and the destination origin is fixed, so the session token
 * can never be sent anywhere except our own API.
 */
const ALLOWED_RESOURCES = new Set(["tasks", "sprints", "users", "auth"]);
const ALLOWED_AUTH_PATHS = new Set(["auth/me"]);
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

type Context = RouteContext<"/api/backend/[...path]">;

async function forward(request: NextRequest, { params }: Context) {
  const { path } = await params;
  const joined = path.join("/");

  const allowed =
    path.every((segment) => SAFE_SEGMENT.test(segment)) &&
    ALLOWED_RESOURCES.has(path[0]) &&
    (path[0] !== "auth" || ALLOWED_AUTH_PATHS.has(joined));
  if (!allowed) {
    return errorEnvelope(404, "not_found", "Not Found");
  }
  if (request.method !== "GET" && isCrossSiteRequest(request)) {
    return errorEnvelope(403, "forbidden", "Cross-site request rejected");
  }

  const token = await getSessionToken();
  if (!token) {
    return errorEnvelope(401, "unauthorized", "Not authenticated");
  }

  const body = request.method === "GET" || request.method === "DELETE" ? undefined : await request.text();
  const response = await callBackend(`/${joined}`, {
    method: request.method,
    body: body || undefined,
    token,
    search: request.nextUrl.search,
    clientIp: clientIpFromRequest(request),
  });

  if (response.status === 401) {
    // Expired or revoked token: drop the cookie so the next navigation goes to /login.
    await clearSessionToken();
  }

  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
