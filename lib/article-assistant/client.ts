import type {
  AnswerAdapter,
  AuthAdapter,
  AnalyticsAdapter,
  EventRecord,
} from "./contracts";
async function request(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "Не удалось получить ответ. Попробуйте ещё раз.",
    );
  return result;
}
export const demoAuth: AuthAdapter = {
  mode: "demo",
  session: async () => {
    const response = await fetch("/api/demo-assistant/auth", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Не удалось проверить вход.");
    return response.json();
  },
  authenticate: (kind) => request("/api/demo-assistant/auth", { kind }),
};
export const siteAuth: AuthAdapter = {
  mode: "real",
  session: async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось проверить вход.");
    const result = await response.json();
    return {
      authenticated: result.authenticated,
      token: result.authenticated ? "site-session" : undefined,
    };
  },
  authenticate: (kind) => request("/api/article-assistant/auth", { kind }),
};
export const siteAnalytics: AnalyticsAdapter = {
  track(event) {
    const counter = Number(process.env.NEXT_PUBLIC_YM_COUNTER_ID);
    if (counter && window.ym) {
      try {
        window.ym(counter, "reachGoal", event.event, {
          article_slug: event.articleSlug,
        });
      } catch {
        /* Analytics must not interrupt a conversation. */
      }
    }
  },
};
export const answerApi: AnswerAdapter = {
  ask: (input, signal) => request("/api/article-assistant", input, signal),
  reveal: (ticket, token, sessionId) =>
    request("/api/article-assistant/reveal", { ticket, token, sessionId }),
};
export const demoApi: AnswerAdapter = {
  ask: (input, signal) => request("/api/demo-assistant", input, signal),
  reveal: (ticket, token, sessionId) =>
    request("/api/demo-assistant/reveal", { ticket, token, sessionId }),
};
// Only memory + a local CustomEvent. No trackers, personal data or external requests.
export function createDemoAnalytics(
  onEvent: (event: EventRecord) => void,
): AnalyticsAdapter {
  return {
    track(event) {
      onEvent(event);
      window.dispatchEvent(
        new CustomEvent("buhexpert:demo-event", { detail: event }),
      );
    },
  };
}
