"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type {
  AuthAdapter,
  AuthResult,
} from "@/lib/article-assistant/contracts";
import s from "./Assistant.module.css";
export function AuthDialog({
  kind,
  adapter,
  onClose,
  onSwitch,
  onSuccess,
}: {
  kind: AuthResult["kind"];
  adapter: AuthAdapter;
  onClose: () => void;
  onSwitch: (kind: AuthResult["kind"]) => void;
  onSuccess: (result: AuthResult) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("reader@example.com");
  const [password, setPassword] = useState("demo-password");
  const [link, setLink] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement as HTMLElement;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby="auth-heading"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const elements = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !busy) onClose();
      }}
    >
      <div className={s.modalInner}>
        <button
          className={s.close}
          aria-label="Закрыть форму"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <Image
          src="/buhexpert/logo.svg"
          alt="Бухэксперт — ваш помощник по учету в 1С"
          width={242}
          height={52}
        />
        <div className={s.demoNotice}>Демонстрация · аккаунт не создается</div>
        <h2 id="auth-heading">
          {kind === "registration"
            ? "Бесплатная регистрация"
            : "Вход в личный кабинет"}
        </h2>
        <p className={s.modalLead}>Ваш вопрос и ответ останутся здесь.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const result = await adapter.authenticate(kind);
              await onSuccess(result);
            } catch {
              setError(
                "Не удалось войти. Попробуйте еще раз — ответ сохранен.",
              );
              setBusy(false);
            }
          }}
        >
          <label htmlFor="demo-email">
            {kind === "login" && !link
              ? "Адрес электронной почты или логин"
              : "Адрес электронной почты"}
          </label>
          <input
            id="demo-email"
            type={kind === "login" && !link ? "text" : "email"}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          {kind === "login" && !link && (
            <>
              <label htmlFor="demo-password">Пароль</label>
              <input
                id="demo-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </>
          )}
          <p className={s.testHint}>
            Используйте тестовые данные. Поля никуда не отправляются, письмо не
            придет.
          </p>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <button className={s.authSubmit} disabled={busy} type="submit">
            {busy
              ? "Открываю ответ…"
              : kind === "registration"
                ? "Зарегистрироваться"
                : link
                  ? "Продолжить по тестовой ссылке"
                  : "Войти"}
          </button>
        </form>
        {kind === "registration" ? (
          <p className={s.legal}>
            На сайте при регистрации принимаются{" "}
            <a
              href="https://buhexpert8.ru/politika-obrabotki-personalnyh-dannyh"
              target="_blank"
              rel="noreferrer"
            >
              условия обработки персональных данных
            </a>
            . В этом прототипе реальные данные не нужны.
          </p>
        ) : (
          <button className={s.link} onClick={() => setLink(!link)}>
            {link ? "Войти с паролем" : "Забыли пароль? Войти по ссылке"}
          </button>
        )}
        <p className={s.loginLine}>
          {kind === "registration" ? "Уже есть аккаунт? " : "Впервые здесь? "}
          <button
            className={s.link}
            disabled={busy}
            onClick={() => {
              setError("");
              onSwitch(kind === "registration" ? "login" : "registration");
            }}
          >
            {kind === "registration" ? "Войти" : "Зарегистрироваться"}
          </button>
        </p>
      </div>
    </dialog>
  );
}
