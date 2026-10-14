"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssistantArticle } from "@/data/sorting-article";
import type {
  AnswerAdapter,
  AnalyticsAdapter,
  AuthAdapter,
  EventName,
  Scenario,
  Turn,
} from "@/lib/article-assistant/contracts";
import { AuthDialog } from "./AuthDialog";
import s from "./Assistant.module.css";

export function Owl() {
  return (
    <svg viewBox="0 0 40 32" fill="none" aria-hidden="true">
      <path
        d="M3 5l9 3m25-3-9 3M17 19l3 6 3-6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15" r="8" stroke="currentColor" strokeWidth="3" />
      <circle cx="28" cy="15" r="8" stroke="currentColor" strokeWidth="3" />
      <circle cx="12" cy="15" r="2" fill="currentColor" />
      <circle cx="28" cy="15" r="2" fill="currentColor" />
    </svg>
  );
}
export function Assistant({
  article,
  scenario = "guest",
  api,
  auth,
  analytics,
  authRequest,
  onAuthChange,
}: {
  article: AssistantArticle;
  scenario?: Scenario;
  api: AnswerAdapter;
  auth: AuthAdapter;
  analytics: AnalyticsAdapter;
  authRequest?: { kind: "registration" | "login"; id: number };
  onAuthChange?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string>();
  const [modal, setModal] = useState<"registration" | "login">();
  const [unread, setUnread] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const session = useRef("");
  const count = useRef(0);
  const flight = useRef(false);
  const pending = useRef<{ question: string; requestId: string } | undefined>(
    undefined,
  );
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const nearBottom = useRef(true);
  const abort = useRef<AbortController>(null);
  const seeded = useRef(false);
  const opened = useRef(false);
  const viewed = useRef(false);
  const initialGroup = ["authenticated", "full", "long"].includes(scenario)
    ? "authenticated"
    : "guest";
  const track = useCallback(
    (event: EventName) =>
      analytics.track({
        event,
        sessionId: session.current,
        articleSlug: article.slug,
        initialGroup,
        questionCount: count.current,
        at: new Date().toISOString(),
        mode: "demo",
      }),
    [analytics, article.slug, initialGroup],
  );
  useEffect(() => {
    session.current ||= crypto.randomUUID();
    if (!opened.current) {
      track("article_view");
      opened.current = true;
    }
    let timer: ReturnType<typeof setTimeout>;
    let ratio = 0;
    const cancel = () => clearTimeout(timer);
    const schedule = () => {
      cancel();
      if (ratio >= 0.5 && !viewed.current && !document.hidden)
        timer = setTimeout(() => {
          viewed.current = true;
          track("article_ai_widget_view");
        }, 1000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        ratio = entry.intersectionRatio;
        schedule();
      },
      { threshold: [0, 0.5, 1] },
    );
    if (card.current) observer.observe(card.current);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      cancel();
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      abort.current?.abort();
    };
  }, [track]);
  useEffect(() => {
    if (!authRequest) return;
    queueMicrotask(() => {
      setModal(authRequest.kind);
      track("auth_form_open");
      if (authRequest.kind === "registration") track("h01_registration_start");
    });
  }, [authRequest, track]);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 128)}px`;
    }
  }, [draft]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      card.current?.style.setProperty(
        "--visual-height",
        `${viewport?.height || window.innerHeight}px`,
      );
      if (document.activeElement === input.current)
        input.current?.scrollIntoView({
          block: "nearest",
          behavior: "instant",
        });
    };
    resize();
    viewport?.addEventListener("resize", resize);
    return () => viewport?.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (log.current && nearBottom.current) {
      log.current.scrollTop = log.current.scrollHeight;
    }
  }, [messages, loading, error]);
  const locked = messages.some((m) => m.locked);
  const openAuth = (kind: "registration" | "login") => {
    setModal(kind);
    track("auth_form_open");
    if (kind === "registration") track("h01_registration_start");
  };
  async function unlock(authToken: string) {
    setUnlocking(true);
    setError("");
    try {
      const updated = await Promise.all(
        messages.map(async (m) =>
          m.locked && m.ticket
            ? {
                ...m,
                content: (
                  await api.reveal(m.ticket, authToken, session.current)
                ).text,
                locked: false,
                ticket: undefined,
              }
            : m,
        ),
      );
      nearBottom.current = false;
      setMessages(updated);
      setUnread(false);
      track("h01_answer_view");
      track("h01_chat_return");
      requestAnimationFrame(() =>
        input.current?.focus({ preventScroll: true }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть ответ.");
    } finally {
      setUnlocking(false);
    }
  }
  async function send(value = draft, retry = false) {
    const question = value.trim();
    if (!question || flight.current || locked) return;
    flight.current = true;
    setLoading(true);
    setError("");
    const requestId =
      retry && pending.current
        ? pending.current.requestId
        : crypto.randomUUID();
    pending.current = { question, requestId };
    setHasPending(true);
    abort.current = new AbortController();
    if (!retry) {
      count.current++;
      track("h01_question_submit");
      setMessages((current) => [
        ...current,
        { id: requestId, role: "user", content: question },
      ]);
    }
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const answer = await api.ask(
        {
          question,
          requestId,
          history: messages.filter((m) => m.id !== requestId),
          articleSlug: article.slug,
          sessionId: session.current,
          token,
          fail: scenario === "error" && !retry,
        },
        abort.current.signal,
      );
      setMessages((current) => [
        ...current,
        {
          id: `answer-${requestId}`,
          role: "assistant",
          content: answer.text,
          locked: answer.locked,
          ticket: answer.ticket,
        },
      ]);
      if (!nearBottom.current) setUnread(true);
      setDraft("");
      pending.current = undefined;
      setHasPending(false);
      track(answer.locked ? "article_ai_answer_shown" : "h01_answer_view");
      if (answer.locked) track("h01_registration_offer");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setDraft(question);
        setError(e instanceof Error ? e.message : "Не удалось получить ответ.");
        track("h01_answer_error");
      }
    } finally {
      flight.current = false;
      setLoading(false);
    }
  }
  useEffect(() => {
    if (seeded.current || scenario === "guest") return;
    seeded.current = true;
    let cancelled = false;
    async function seed() {
      await Promise.resolve();
      if (cancelled) return;
      let demoToken: string | undefined;
      if (initialGroup === "authenticated") {
        demoToken = (await auth.authenticate("login")).token;
        if (cancelled) return;
        setToken(demoToken);
      }
      if (scenario === "authenticated") return;
      const question =
        scenario === "long"
          ? "Расскажите подробно о сортировке сотрудников"
          : article.suggestions[0];
      const id = crypto.randomUUID();
      count.current++;
      track("h01_question_submit");
      const first: Turn = { id, role: "user", content: question };
      setMessages([first]);
      if (scenario === "loading") {
        setLoading(true);
        flight.current = true;
        return;
      }
      if (scenario === "error") {
        setDraft(question);
        pending.current = { question, requestId: id };
        setHasPending(true);
        setError("Не удалось связаться с помощником. Ваш вопрос сохранен.");
        track("h01_answer_error");
        return;
      }
      setLoading(true);
      try {
        const result = await api.ask(
          {
            question,
            requestId: id,
            history: [],
            articleSlug: article.slug,
            sessionId: session.current,
            token: demoToken,
          },
          new AbortController().signal,
        );
        if (cancelled) return;
        const answer: Turn = {
          id: `answer-${id}`,
          role: "assistant",
          content: result.text,
          locked: result.locked,
          ticket: result.ticket,
        };
        const turns = [first, answer];
        if (scenario === "long")
          for (let i = 0; i < 5; i++) {
            const q =
              i % 2
                ? "А по табельному номеру?"
                : "Можно сортировать по подразделению?";
            const r = await api.ask(
              {
                question: q,
                requestId: crypto.randomUUID(),
                history: turns,
                articleSlug: article.slug,
                sessionId: session.current,
                token: demoToken,
              },
              new AbortController().signal,
            );
            if (cancelled) return;
            count.current++;
            track("h01_question_submit");
            turns.push(
              { id: `u-${i}`, role: "user", content: q },
              { id: `a-${i}`, role: "assistant", content: r.text },
            );
          }
        setMessages([...turns]);
        track(result.locked ? "article_ai_answer_shown" : "h01_answer_view");
        if (scenario === "register" || scenario === "login") {
          setModal(scenario === "register" ? "registration" : "login");
          track("auth_form_open");
          if (scenario === "register") track("h01_registration_start");
        }
      } catch {
        if (!cancelled)
          setError("Не удалось загрузить пример. Обновите страницу.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void seed();
    return () => {
      cancelled = true;
      seeded.current = false;
    };
  }, [scenario, initialGroup, auth, api, article, track]);
  function reset() {
    abort.current?.abort();
    pending.current = undefined;
    setHasPending(false);
    flight.current = false;
    setMessages([]);
    setDraft("");
    setError("");
    setLoading(false);
    setUnread(false);
    nearBottom.current = true;
    setTimeout(() => input.current?.focus(), 0);
  }
  const expanded = messages.length > 0;
  return (
    <section
      ref={card}
      id="assistant"
      className={`${s.card} ${expanded ? s.expanded : ""}`}
      aria-label="ИИ-помощник по статье"
    >
      <div className={s.header}>
        <span className={s.mark}>
          <Owl />
        </span>
        <div>
          <div className={s.eyebrow}>ИИ-помощник Бухэксперта</div>
          {expanded && (
            <span className={s.context}>По содержанию этой статьи</span>
          )}
        </div>
        {expanded && (
          <button
            className={s.reset}
            onClick={reset}
            disabled={loading && scenario !== "loading"}
          >
            Новый диалог
          </button>
        )}
      </div>
      {!expanded && (
        <div className={s.intro}>
          <h2>Есть вопрос по вашей ситуации?</h2>
          <p>Помогу разобраться с учетом содержания этой статьи.</p>
        </div>
      )}
      {expanded && (
        <div
          ref={log}
          className={s.messages}
          role="region"
          aria-label="Переписка"
          tabIndex={0}
          onScroll={() => {
            if (log.current)
              nearBottom.current =
                log.current.scrollHeight -
                  log.current.scrollTop -
                  log.current.clientHeight <
                70;
            if (nearBottom.current) setUnread(false);
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? s.question : s.answer}
            >
              <div className={s.messageLabel}>
                {m.role === "user" ? "Ваш вопрос" : "Бухэксперт · ИИ-помощник"}
              </div>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  a: (props) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            </div>
          ))}
          {loading && (
            <div className={s.loading} role="status">
              <span className={s.spinner} />
              Готовлю ответ по статье
            </div>
          )}
          {locked && (
            <div className={s.gate}>
              <span className={s.lockIcon} aria-hidden="true">
                ↳
              </span>
              <div>
                <h3>Продолжим разбираться вместе</h3>
                <p>
                  После бесплатной регистрации откроется этот ответ. Вы сможете
                  задать уточняющий вопрос здесь же.
                </p>
                {token ? (
                  <button
                    className={s.primary}
                    disabled={unlocking}
                    onClick={() => void unlock(token)}
                  >
                    {unlocking
                      ? "Открываю ответ…"
                      : "Открыть сохраненный ответ"}
                  </button>
                ) : (
                  <>
                    <button
                      className={s.primary}
                      onClick={() => openAuth("registration")}
                    >
                      Зарегистрироваться и посмотреть ответ
                    </button>
                    <div className={s.loginLine}>
                      Уже есть аккаунт?{" "}
                      <button
                        className={s.link}
                        onClick={() => openAuth("login")}
                      >
                        Войти
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className={s.error} role="alert">
              <strong>
                {locked
                  ? "Ответ пока не открылся"
                  : "Не удалось получить ответ"}
              </strong>
              <p>{error}</p>
              {hasPending && (
                <button
                  className={s.retry}
                  onClick={() => void send(pending.current!.question, true)}
                >
                  Повторить запрос
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {unread && (
        <button
          className={s.newMessages}
          onClick={() => {
            if (log.current) log.current.scrollTop = log.current.scrollHeight;
            setUnread(false);
          }}
        >
          К новым сообщениям ↓
        </button>
      )}
      {!locked && (
        <form
          className={s.composer}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="assistant-question">
            {expanded ? "Уточните вашу ситуацию" : "Ваш вопрос"}
          </label>
          <div className={s.inputRow}>
            <textarea
              ref={input}
              id="assistant-question"
              rows={2}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                expanded
                  ? "Напишите уточняющий вопрос"
                  : "Напишите, что хотите уточнить"
              }
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              className={s.primary}
              disabled={!draft.trim() || loading || hasPending}
              type="submit"
            >
              {loading
                ? "Готовлю ответ…"
                : expanded
                  ? "Отправить"
                  : "Получить ответ"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          {!expanded && (
            <>
              <div className={s.examples}>
                <span>Например:</span>
                {article.suggestions.map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => {
                      setDraft(q);
                      input.current?.focus();
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              {!token && (
                <p className={s.condition}>
                  Начало ответа — сразу. Полный ответ — после бесплатной
                  регистрации.
                </p>
              )}
            </>
          )}
        </form>
      )}
      <p className={s.disclaimer}>
        ИИ может ошибаться. Сверяйте ответ с материалами статьи.
      </p>
      {modal && (
        <AuthDialog
          kind={modal}
          adapter={auth}
          onSwitch={openAuth}
          onClose={() => setModal(undefined)}
          onSuccess={async (result) => {
            setToken(result.token);
            setModal(undefined);
            onAuthChange?.();
            track(
              result.kind === "registration"
                ? "h01_registration_success"
                : "h01_existing_login",
            );
            if (locked) await unlock(result.token);
          }}
        />
      )}
    </section>
  );
}
