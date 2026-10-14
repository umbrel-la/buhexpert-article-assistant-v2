import { NextRequest, NextResponse } from "next/server";
import { authorized, unseal } from "@/lib/article-assistant/server";
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) ?? {};
  if (!(await authorized(request, body.token)))
    return NextResponse.json(
      { error: "Войдите, чтобы открыть ответ." },
      { status: 401 },
    );
  try {
    const result = unseal(body.ticket);
    if (result.type !== "answer" || result.sessionId !== body.sessionId)
      throw new Error("Invalid answer");
    return NextResponse.json(
      { text: result.text },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Не удалось открыть сохраненный ответ. Попробуйте снова." },
      { status: 400 },
    );
  }
}
