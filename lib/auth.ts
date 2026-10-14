import "server-only";

import type { NextRequest } from "next/server";

export type ServerSession = {
  authenticated: boolean;
  userId?: string;
  mode: "demo" | "real";
};

/**
 * Adapter boundary for the production authentication provider.
 * Replace the cookie lookup with the site's session verification (for example,
 * a signed cookie or a call to the existing identity provider). It deliberately
 * runs only on the server and never exposes credentials to a Client Component.
 */
export async function getServerSession(
  request: NextRequest,
): Promise<ServerSession> {
  if (process.env.AUTH_MODE !== "real")
    return { authenticated: false, mode: "demo" };

  const sessionId = request.cookies.get(
    process.env.BUHEXPERT_SESSION_COOKIE || "buhexpert_session",
  )?.value;
  if (!sessionId) return { authenticated: false, mode: "real" };

  const endpoint = process.env.BUHEXPERT_SESSION_VERIFY_URL;
  const apiKey = process.env.BUHEXPERT_SESSION_VERIFY_KEY;
  // This bridge must be implemented by the site's identity backend.
  // A cookie existing on its own is never proof of authentication.
  if (!endpoint || !apiKey) return { authenticated: false, mode: "real" };
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  if (response.status === 401 || response.status === 403)
    return { authenticated: false, mode: "real" };
  if (!response.ok) throw new Error("Session verification unavailable");
  const result = await response.json();
  const authenticated =
    result.authenticated === true &&
    typeof result.userId === "string" &&
    result.userId.length > 0;
  return {
    authenticated,
    userId: authenticated ? result.userId : undefined,
    mode: "real",
  };
}
