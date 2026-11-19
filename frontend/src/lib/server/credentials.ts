import "server-only";

import {
  callBackend,
  errorEnvelope,
  isCrossSiteRequest,
  setSessionToken,
} from "@/lib/server/backend";

type TokenPayload = {
  success: true;
  data: { access_token: string; expires_in: number; user: unknown };
};

/**
 * Exchange credentials with the API (login or register). On success the token is stored in an
 * httpOnly cookie and only the user object is returned to the browser.
 */
export async function exchangeCredentials(request: Request, path: "/auth/login" | "/auth/register") {
  if (isCrossSiteRequest(request)) {
    return errorEnvelope(403, "forbidden", "Cross-site request rejected");
  }

  const response = await callBackend(path, { method: "POST", body: await request.text() });
  const payload = await response.json();
  if (!response.ok) {
    return Response.json(payload, { status: response.status });
  }

  const { access_token, expires_in, user } = (payload as TokenPayload).data;
  await setSessionToken(request, access_token, expires_in);
  return Response.json(
    { success: true, data: { user }, meta: null, error: null },
    { status: response.status },
  );
}
