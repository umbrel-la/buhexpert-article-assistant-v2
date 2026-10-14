"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { sortingArticle as article } from "@/data/sorting-article";
import { Assistant } from "./article-assistant/Assistant";
import {
  demoApi,
  createDemoAnalytics,
  demoAuth,
  answerApi,
  siteAuth,
  siteAnalytics,
} from "@/lib/article-assistant/client";
import type { EventRecord, Scenario } from "@/lib/article-assistant/contracts";
import s from "./ArticlePrototype.module.css";
const scenarios: [Scenario, string][] = [
  ["guest", "Посетитель"],
  ["preview", "Начало ответа"],
  ["register", "Регистрация"],
  ["login", "Вход"],
  ["full", "Полный ответ"],
  ["authenticated", "Вошел заранее"],
  ["long", "Длинный диалог"],
  ["loading", "Загрузка"],
  ["error", "Ошибка"],
];
const nav = [
  "Настройка интерфейса",
  "Настройка видимости объектов",
  "Работа со списками и журналами документов",
  "Работа с «Избранным» и «Историей»",
];
export function ArticlePrototype({
  demo = false,
  enabled = true,
  mode = "demo",
}: {
  demo?: boolean;
  enabled?: boolean;
  mode?: "demo" | "real";
}) {
  const [scenario, setScenario] = useState<Scenario>("guest");
  const [revision, setRevision] = useState(0);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [authRequest, setAuthRequest] = useState<{
    kind: "registration" | "login";
    id: number;
  }>();
  const [loggedIn, setLoggedIn] = useState(false);
  const requestAuth = (kind: "registration" | "login") => {
    setMenu(false);
    setAuthRequest({ kind, id: Date.now() });
  };
  const analytics = useMemo(
    () =>
      createDemoAnalytics((event) =>
        setEvents((current) => [...current.slice(-199), event]),
      ),
    [],
  );
  return (
    <div className={s.site}>
      <a className={s.skip} href="#article">
        К статье
      </a>
      <header className={s.header}>
        <Link href="/" className={s.logo}>
          <Image
            src="/buhexpert/logo-white.png"
            alt="Бухэксперт — ваш помощник по учету в 1С"
            width={210}
            height={45}
            priority
          />
        </Link>
        <button
          className={s.sections}
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
        >
          Все разделы <span>⌄</span>
        </button>
        <form
          className={s.search}
          onSubmit={(e) => {
            e.preventDefault();
            setSearchResult(true);
          }}
        >
          <input
            aria-label="Поиск по базе знаний"
            placeholder="Поиск по базе знаний"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button aria-label="Найти">⌕</button>
        </form>
        <a className={s.help} href="#assistant" aria-label="Задать вопрос">
          ?
        </a>
        <a
          className={s.subscription}
          href="https://buhexpert8.ru/price"
          target="_blank"
          rel="noreferrer"
        >
          ✦ Купить подписку
        </a>
        <div className={s.account}>
          {loggedIn ? (
            <span>
              Вы вошли
              <br />
              <small>Тестовый аккаунт</small>
            </span>
          ) : (
            <>
              <button onClick={() => requestAuth("login")}>Войти</button>
              <button onClick={() => requestAuth("registration")}>
                Регистрация
              </button>
            </>
          )}
        </div>
        <button
          className={s.mobileMenu}
          onClick={() => setMenu(!menu)}
          aria-label="Открыть меню"
          aria-expanded={menu}
        >
          ☰
        </button>
      </header>
      {menu && (
        <nav className={s.dropdown} aria-label="Разделы сайта">
          {["1С Бухгалтерия", "1С ЗУП", "Законодательство", "Академия"].map(
            (t, i) => (
              <a
                key={t}
                href={
                  [
                    "https://buhexpert8.ru/1s-buhgalteriya",
                    "https://buhexpert8.ru/1s-zup",
                    "https://buhexpert8.ru/zakonodatelstvo",
                    "https://buhexpert8.ru/kursy",
                  ][i]
                }
              >
                {t} ↗
              </a>
            ),
          )}
          <button onClick={() => setMenu(false)}>Закрыть меню ×</button>
          <button onClick={() => requestAuth("login")}>
            Войти в тестовый аккаунт
          </button>
        </nav>
      )}
      {searchResult && (
        <div className={s.searchResult} role="status">
          <strong>Поиск в демонстрационной странице</strong>
          <p>
            {!search || /сорт|сотруд|алфавит|зуп/i.test(search) ? (
              <a href="#article" onClick={() => setSearchResult(false)}>
                {article.title}
              </a>
            ) : (
              "В этой демонстрации доступна статья о сортировке сотрудников. Для поиска других материалов перейдите на Бухэксперт."
            )}
          </p>
          <button onClick={() => setSearchResult(false)}>Закрыть</button>
        </div>
      )}
      <div className={s.rail} aria-label="Быстрая навигация">
        <button onClick={() => setMenu(!menu)} aria-label="Все разделы">
          »
        </button>
        <a href="#navigation" aria-label="Рубрикатор">
          ▦
        </a>
        <a href="#comments" aria-label="Комментарии">
          ◕
        </a>
        <a href="#related" aria-label="Публикации">
          ✎
        </a>
        <a href="#assistant" aria-label="Помощник">
          ?
        </a>
      </div>
      <aside id="navigation" className={s.sidebar}>
        <div className={s.sidebarTitle}>⌂ &nbsp; ИНТЕРФЕЙС 1С:ЗУП 3</div>
        <nav>
          {nav.map((t, i) => (
            <a
              href={
                i === 0
                  ? "#instructions"
                  : "https://buhexpert8.ru/1s-zup/vozmozhnosti-i-nastrojki-1s-zup-3/interfejs-1s-zup-3"
              }
              key={t}
            >
              {t}
            </a>
          ))}
        </nav>
        <div className={s.sidebarNote}>
          <span>В ЭТОЙ СТАТЬЕ</span>
          <a href="#assistant">
            Задать вопрос по статье <b>↗</b>
          </a>
          <a href="#instructions">Настройка сортировки</a>
          <a href="#illustration">Пример в 1С</a>
        </div>
        <div className={s.reviewLink}>
          <span>Интерактивный прототип</span>
          <Link href={demo ? "/" : "/demo"}>
            {demo ? "Открыть статью" : "Посмотреть все состояния"} →
          </Link>
        </div>
      </aside>
      <main id="article" className={s.main}>
        {demo && (
          <section className={s.demoPanel} aria-label="Панель демонстрации">
            <div>
              <span className={s.demoLabel}>СТУДИЯ ПРОТОТИПА</span>
              <h2>Проверьте путь читателя</h2>
              <p>
                Тестовые ответы и авторизация. Выбор состояния начинает новую
                сессию.
              </p>
            </div>
            <div className={s.scenarios}>
              {scenarios.map(([value, title]) => (
                <button
                  key={value}
                  aria-pressed={scenario === value}
                  onClick={() => {
                    setScenario(value);
                    setRevision((x) => x + 1);
                    setEvents([]);
                    setAuthRequest(undefined);
                    setLoggedIn(
                      ["authenticated", "full", "long"].includes(value),
                    );
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
            <details className={s.events}>
              <summary>События этой сессии · {events.length}</summary>
              <ol>
                {events.map((e, i) => (
                  <li key={i}>
                    <code>{e.event}</code> · группа: {e.initialGroup} ·
                    вопросов: {e.questionCount}
                  </li>
                ))}
              </ol>
            </details>
          </section>
        )}
        <nav className={s.breadcrumbs} aria-label="Хлебные крошки">
          <a href="https://buhexpert8.ru/">Главная страница</a>
          <span>»</span>
          <a href="https://buhexpert8.ru/1s-zup">1С ЗУП</a>
          <span>»</span>
          <a href="#navigation">Возможности и настройки 1С:ЗУП 3</a>
          <span>»</span>
          <a href="#navigation">Интерфейс 1С:ЗУП 3</a>
        </nav>
        <article>
          <h1>{article.title}</h1>
          {(demo || enabled) && (
            <Assistant
              key={`${article.slug}-${scenario}-${revision}`}
              article={article}
              scenario={scenario}
              api={demo || mode === "demo" ? demoApi : answerApi}
              auth={demo || mode === "demo" ? demoAuth : siteAuth}
              analytics={demo || mode === "demo" ? analytics : siteAnalytics}
              restoreAuth={!demo}
              authRequest={authRequest}
              onAuthChange={setLoggedIn}
            />
          )}
          <div className={s.date}>
            Последнее изменение:{" "}
            <time dateTime="2019-08-09">{article.updatedAt}</time>
          </div>
          <blockquote className={s.readerQuestion}>
            <span aria-hidden="true">?</span>
            <p>
              Необходимо, чтобы в документах сотрудники «выстраивались» по
              алфавиту. Можно это настроить?
            </p>
          </blockquote>
          <p className={s.articleText}>{article.intro}</p>
          <div id="instructions" className={s.instructions}>
            <p>
              Настройка производится в разделе{" "}
              <strong>Настройка – Дополнительные настройки.</strong>
            </p>
            <p>
              Чтобы сортировка осуществлялась по ФИО сотрудника, необходимо на
              первое место передвинуть пункт{" "}
              <strong>По сотруднику (Имя)</strong>, используя кнопки с синими
              стрелочками. Есть возможность определить сортировку не только по
              ФИО, но и по табельному номеру, а также по подразделениям и
              должностям.
            </p>
          </div>
          <aside className={s.books}>
            <span aria-hidden="true">♧</span>
            <div>
              <b>Получите понятные самоучители 2026 по 1С бесплатно:</b>
              <ul>
                <li>
                  <a href="https://buhexpert8.ru/lpbuh">
                    Самоучитель по 1С Бухгалтерии 8.3
                  </a>
                  ;
                </li>
                <li>
                  <a href="https://buhexpert8.ru/lpzup">
                    Самоучитель по 1С ЗУП 8.3
                  </a>
                  .
                </li>
              </ul>
            </div>
          </aside>
          <figure id="illustration" className={s.illustration}>
            <button
              onClick={() => setZoom(true)}
              aria-label="Увеличить иллюстрацию дополнительных настроек"
            >
              <Image
                src="/buhexpert/sorting.jpg"
                alt="Дополнительные настройки ЗУП: По сотруднику (Имя) на первом месте, ниже По подразделению (Приоритет) и По должности (Приоритет). Справа синие стрелки изменения порядка."
                width={1134}
                height={600}
                className={s.screenshot}
              />
              <span>Увеличить изображение ↗</span>
            </button>
            <figcaption>
              Дополнительные настройки. Иллюстрация из статьи Бухэксперта.
            </figcaption>
          </figure>
          <div className={s.bonus}>
            <b>Помогла статья?</b>
            <p>
              Получите еще секретный бонус и полный доступ к справочной системе
              Бухэксперт на 8 дней бесплатно.
            </p>
            <a href="https://buhexpert8.ru/register/">
              Подробнее на Бухэксперт ↗
            </a>
          </div>
          <section id="related" className={s.related}>
            <h2>Похожие публикации</h2>
            {[
              "Дополнительные настройки",
              "Как настроить вид занятости сотрудника в ЗУП 3?",
              "Как сделать, чтобы ФИО сотрудника в печатных формах выводилось полностью?",
              "Как настроить префикс номера формы Т-1 в ЗУП 3?",
            ].map((title, i) => (
              <a
                key={title}
                href={
                  [
                    "https://buhexpert8.ru/1s-zup/vozmozhnosti-i-nastrojki-1s-zup-3/nastrojki-zup/dopolnitelnye-nastrojki-2.html",
                    "https://buhexpert8.ru/1s-zup/uchet-otdelnyh-kategorij-rabotnikov/sovmestiteli/kak-nastroit-vid-zanyatosti-sotrudnika-v-zup-3.html",
                    "https://buhexpert8.ru/1s-zup/otchetnost/otchety-po-zarplate/kak-sdelat-chtoby-fio-sotrudnika-v-pechatnyh-formah-vyvodilos-polnostyu.html",
                    "https://buhexpert8.ru/1s-zup/vozmozhnosti-i-nastrojki-1s-zup-3/nastrojki-zup/kak-nastroit-prefiks-nomera-formy-t-1-v-zup-3.html",
                  ][i]
                }
              >
                <span>0{i + 1}</span>
                {title}
                <b>↗</b>
              </a>
            ))}
          </section>
          <section id="comments" className={s.comments}>
            <h2>Все комментарии (1)</h2>
            <p className={s.commentNote}>
              Публикацию можно обсудить в комментариях. Индивидуальные
              консультации экспертов доступны в личном кабинете.
            </p>
            <div className={s.comment}>
              <span>Н</span>
              <div>
                <b>Надежда М.</b>
                <small>Подписчик Бухэксперт · 25.05.2021 в 08:27</small>
                <p>Спасибо, очень нужно</p>
              </div>
            </div>
            <p>
              Для отправки комментария необходимо{" "}
              <a href={article.url}>авторизоваться на сайте</a>.
            </p>
          </section>
        </article>
        <footer className={s.footer}>
          <Image
            src="/buhexpert/logo.svg"
            alt="Бухэксперт"
            width={180}
            height={40}
          />
          <p>
            Демонстрационная копия для согласования интерфейса.
            <br />
            Материал и иллюстрация — <a href={article.url}>Бухэксперт</a>. Дата
            статьи: 09.08.2019.
          </p>
          <Link href="/demo">Все состояния помощника →</Link>
        </footer>
      </main>
      {zoom && (
        <div
          className={s.zoom}
          role="dialog"
          aria-modal="true"
          aria-label="Иллюстрация дополнительных настроек"
          onClick={() => setZoom(false)}
        >
          <button
            autoFocus
            onClick={() => setZoom(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setZoom(false);
            }}
            aria-label="Закрыть изображение"
          >
            ×
          </button>
          <Image
            src="/buhexpert/sorting.jpg"
            alt="Дополнительные настройки ЗУП, увеличенное изображение"
            width={1134}
            height={600}
          />
        </div>
      )}
    </div>
  );
}
