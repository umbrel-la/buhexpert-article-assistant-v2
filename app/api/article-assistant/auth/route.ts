import { NextRequest, NextResponse } from "next/server";
import { isDemo, seal } from "@/lib/article-assistant/server";
export async function POST(request: NextRequest) {
  if (!isDemo())
    return NextResponse.json(
      { error: "Подключите авторизацию Бухэксперта." },
      { status: 501 },
    );
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (kind !== "registration" && kind !== "login")
    return NextResponse.json(
      { error: "Некорректное действие." },
      { status: 400 },
    );
  return NextResponse.json(
    { token: seal({ type: "demo-auth" }), kind },
    { headers: { "Cache-Control": "no-store" } },
  );
}
