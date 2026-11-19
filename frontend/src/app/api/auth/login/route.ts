import { exchangeCredentials } from "@/lib/server/credentials";

export async function POST(request: Request) {
  return exchangeCredentials(request, "/auth/login");
}
