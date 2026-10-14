import { NextRequest, NextResponse } from "next/server";
import { seal } from "@/lib/article-assistant/server";
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (kind !== "registration" && kind !== "login")
    return NextResponse.json(
      { error: "Некорректное действие." },
      { status: 400 },
    );
  return NextResponse.json(
    { token: seal({ type: "demo-auth" }, true), kind },
    { headers: { "Cache-Control": "no-store" } },
  );
}
