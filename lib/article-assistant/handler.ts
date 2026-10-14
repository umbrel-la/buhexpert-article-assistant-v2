import { NextRequest, NextResponse } from "next/server";
import { sortingArticle } from "@/data/sorting-article";
import { getArticleContext } from "@/data/article-context";
import { createAiAnswer, answerPreview } from "@/lib/ai";
import { fixture } from "@/lib/article-assistant/fixtures";
import {
  assistantIdentity,
  isDemo,
  pilotEnabled,
  seal,
} from "@/lib/article-assistant/server";
import type { ChatTurn } from "@/types";
import { readHistory, saveHistory, type HistoryRecord } from "./history";
export async function handleAsk(request: NextRequest, demo = isDemo()) {
  if (!demo && !pilotEnabled())
    return NextResponse.json(
      { error: "Пилот помощника завершен." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  const article =
    typeof body?.articleSlug === "string"
      ? getArticleContext(body.articleSlug)
      : null;
  if (
    !body ||
    typeof body.question !== "string" ||
    !body.question.trim() ||
    body.question.length > 2000 ||
    !article ||
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
    const identity = await assistantIdentity(request, body.token, demo);
    const saved = await readHistory(body.sessionId, body.requestId, demo);
    if (
      saved &&
      (saved.question !== body.question || saved.articleSlug !== article.slug)
    )
      return NextResponse.json(
        { error: "Этот запрос уже относится к другому вопросу." },
        { status: 409 },
      );
    const record: HistoryRecord = saved || {
      sessionId: body.sessionId,
      requestId: body.requestId,
      articleSlug: article.slug,
      question: body.question,
      history: body.history.map(({ role, content }: ChatTurn) => ({
        role,
        content,
      })),
      userId: identity.userId,
      mode: demo ? "demo" : "real",
      createdAt: new Date().toISOString(),
    };
    await saveHistory(record);
    let answer =
      article.slug === sortingArticle.slug
        ? fixture(body.question)
        : {
            preview: answerPreview(article.text),
            full: article.text,
          };
    if (saved?.answer) {
      answer = { preview: answerPreview(saved.answer), full: saved.answer };
    } else if (!demo) {
      if (!process.env.AI_API_KEY) throw new Error("AI key missing");
      const result = await createAiAnswer(
        body.question,
        [],
        0,
        body.history,
        article,
      );
      answer = {
        preview: answerPreview(result.shortAnswer),
        full: result.shortAnswer,
      };
    }
    await saveHistory({
      ...record,
      answer: answer.full,
      userId: identity.userId || record.userId,
    });
    const loggedIn = identity.authenticated;
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
                requestId: body.requestId,
                articleSlug: article.slug,
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
