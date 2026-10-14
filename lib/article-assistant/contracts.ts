export type Turn = {
  role: "user" | "assistant";
  content: string;
  id: string;
  locked?: boolean;
  ticket?: string;
};
export type Scenario =
  | "guest"
  | "preview"
  | "register"
  | "login"
  | "full"
  | "authenticated"
  | "long"
  | "loading"
  | "error";
export type AuthResult = { token: string; kind: "registration" | "login" };
export interface AuthAdapter {
  mode: "demo" | "real";
  session(): Promise<{ authenticated: boolean; token?: string }>;
  authenticate(kind: AuthResult["kind"]): Promise<AuthResult>;
}
export interface AnswerAdapter {
  ask(
    input: {
      question: string;
      history: Turn[];
      articleSlug: string;
      sessionId: string;
      token?: string;
      requestId: string;
      fail?: boolean;
    },
    signal: AbortSignal,
  ): Promise<{ text: string; locked: boolean; ticket?: string }>;
  reveal(
    ticket: string,
    token: string,
    sessionId: string,
  ): Promise<{ text: string }>;
}
export type EventName =
  | "article_view"
  | "article_ai_widget_view"
  | "h01_question_submit"
  | "article_ai_answer_shown"
  | "h01_registration_offer"
  | "h01_registration_start"
  | "h01_registration_success"
  | "h01_existing_login"
  | "h01_answer_view"
  | "h01_answer_error"
  | "h01_chat_return"
  | "auth_form_open";
export type EventRecord = {
  event: EventName;
  sessionId: string;
  articleSlug: string;
  initialGroup: "guest" | "authenticated";
  questionCount: number;
  at: string;
  mode: "demo" | "real";
};
export interface AnalyticsAdapter {
  track(event: EventRecord): void;
}
