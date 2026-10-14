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
  authenticate: (kind) => request("/api/demo-assistant/auth", { kind }),
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
