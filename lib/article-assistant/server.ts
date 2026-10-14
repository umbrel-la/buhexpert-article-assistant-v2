import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth";
export const isDemo = () => process.env.ASSISTANT_MODE !== "real";
// Demo-only key contains no real accounts or AI answers. Real mode requires a private key.
function key(demo = isDemo()) {
  const secret = demo
    ? "public-demo-fixtures-only-v2"
    : process.env.ASSISTANT_TOKEN_SECRET;
  if (!secret) throw new Error("ASSISTANT_TOKEN_SECRET is required");
  return createHash("sha256").update(secret).digest();
}
export function seal(payload: object, demo = isDemo()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(demo), iv);
  const data = Buffer.concat([
    cipher.update(
      JSON.stringify({ ...payload, expires: Date.now() + 86400000 }),
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function unseal(token: string, demo = isDemo()) {
  if (typeof token !== "string" || token.length > 100000)
    throw new Error("Invalid token");
  const data = Buffer.from(token, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(demo),
    data.subarray(0, 12),
  );
  cipher.setAuthTag(data.subarray(12, 28));
  const payload = JSON.parse(
    Buffer.concat([
      cipher.update(data.subarray(28)),
      cipher.final(),
    ]).toString(),
  );
  if (payload.expires < Date.now()) throw new Error("Expired token");
  return payload;
}
export async function authorized(
  request: NextRequest,
  token?: string,
  demo = isDemo(),
) {
  return (await assistantIdentity(request, token, demo)).authenticated;
}
export async function assistantIdentity(
  request: NextRequest,
  token?: string,
  demo = isDemo(),
) {
  if (!demo) return getServerSession(request);
  try {
    const payload = unseal(token || "", true);
    return {
      authenticated: payload.type === "demo-auth",
      userId: payload.type === "demo-auth" ? "demo-reader" : undefined,
    };
  } catch {
    return { authenticated: false, userId: undefined };
  }
}
export function pilotEnabled(now = Date.now()) {
  if (isDemo()) return true;
  const start = Date.parse(process.env.ASSISTANT_PILOT_START || "");
  return (
    process.env.ASSISTANT_ENABLED === "true" &&
    Number.isFinite(start) &&
    now >= start &&
    now < start + 86400000
  );
}
