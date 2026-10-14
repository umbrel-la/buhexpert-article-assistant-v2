import { NextRequest, NextResponse } from "next/server";
import { authorized, seal } from "@/lib/article-assistant/server";
export async function GET(request: NextRequest) {
  const token = request.cookies.get("assistant_demo_auth")?.value;
  const authenticated = await authorized(request, token, true);
  return NextResponse.json(
    { authenticated, token: authenticated ? token : undefined },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (kind !== "registration" && kind !== "login")
    return NextResponse.json(
      { error: "Некорректное действие." },
      { status: 400 },
    );
  const token = seal({ type: "demo-auth" }, true);
  const response = NextResponse.json(
    { token, kind },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set("assistant_demo_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 86400,
  });
  return response;
}
