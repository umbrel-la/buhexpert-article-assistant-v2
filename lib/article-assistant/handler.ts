import { NextRequest, NextResponse } from "next/server";
import { sortingArticle } from "@/data/sorting-article";
import { createAiAnswer, answerPreview } from "@/lib/ai";
import { fixture } from "@/lib/article-assistant/fixtures";
import {
  authorized,
  isDemo,
  pilotEnabled,
  seal,
} from "@/lib/article-assistant/server";
import type { ChatTurn } from "@/types";
export async function handleAsk(request: NextRequest, demo = isDemo()) {
  if (!demo && !pilotEnabled())
    return NextResponse.json(
      { error: "Пилот помощника завершен." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.question !== "string" ||
    !body.question.trim() ||
    body.question.length > 2000 ||
    body.articleSlug !== sortingArticle.slug ||
    !/^[\w-]{16,120}$/.test(body.sessionId || "") ||
    !/^[\w-]{16,120}$/.test(body.requestId || "")
  )
    return NextResponse.json(
      { error: "Проверьте вопрос и контекст статьи." },
      { status: 400 },
    );
  if (
    !Array.isArray(body.history) ||
    body.history.length > 100 ||
    body.history.some(
      (t: ChatTurn) =>
        !t ||
        !["user", "assistant"].includes(t.role) ||
        typeof t.content !== "string",
    ) ||
    JSON.stringify(body.history).length > 60000
  )
    return NextResponse.json(
      { error: "Диалог слишком длинный. Начните новый диалог." },
      { status: 400 },
    );
  if (demo && body.fail)
    return NextResponse.json(
      { error: "Не удалось связаться с помощником. Ваш вопрос сохранен." },
      { status: 502 },
    );
  try {
    let answer = fixture(body.question);
    if (!demo) {
      if (!process.env.AI_API_KEY) throw new Error("AI key missing");
      const result = await createAiAnswer(
        body.question,
        [],
        0,
        body.history,
        sortingArticle,
      );
      answer = {
        preview: answerPreview(result.shortAnswer),
        full: result.shortAnswer,
      };
    }
    const loggedIn = await authorized(request, body.token, demo);
    return NextResponse.json(
      loggedIn
        ? { text: answer.full, locked: false }
        : {
            text: answer.preview,
            locked: true,
            ticket: seal(
              {
                type: "answer",
                sessionId: body.sessionId,
                text: answer.full,
              },
              demo,
            ),
          },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Не удалось получить ответ. Попробуйте ещё раз." },
      { status: 502 },
    );
  }
}
