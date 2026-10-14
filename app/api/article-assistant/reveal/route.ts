import { NextRequest, NextResponse } from "next/server";
import {
  assistantIdentity,
  isDemo,
  unseal,
} from "@/lib/article-assistant/server";
import { bindHistory } from "@/lib/article-assistant/history";
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) ?? {};
  const identity = await assistantIdentity(request, body.token);
  if (!identity.authenticated)
    return NextResponse.json(
      { error: "Войдите, чтобы открыть ответ." },
      { status: 401 },
    );
  try {
    const result = unseal(body.ticket);
    if (result.type !== "answer" || result.sessionId !== body.sessionId)
      throw new Error("Invalid answer");
    if (result.requestId)
      await bindHistory(
        result.sessionId,
        result.requestId,
        identity.userId,
        isDemo(),
      );
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
