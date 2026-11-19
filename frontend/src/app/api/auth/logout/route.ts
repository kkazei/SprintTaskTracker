import { clearSessionToken, errorEnvelope, isCrossSiteRequest } from "@/lib/server/backend";

export async function POST(request: Request) {
  if (isCrossSiteRequest(request)) {
    return errorEnvelope(403, "forbidden", "Cross-site request rejected");
  }
  await clearSessionToken();
  return Response.json({ success: true, data: null, meta: null, error: null });
}
