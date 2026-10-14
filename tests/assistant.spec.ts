import { test, expect, Page } from "@playwright/test";
import type { EventRecord } from "../lib/article-assistant/contracts";
declare global {
  interface Window {
    prototypeEvents: EventRecord[];
  }
}
const widget = (page: Page) =>
  page.getByRole("region", { name: "ИИ-помощник по статье", exact: true });
const log = (page: Page) =>
  page.getByRole("region", { name: "Переписка", exact: true });
async function screenshot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.prototypeEvents = [];
    window.addEventListener("buhexpert:demo-event", (e) =>
      window.prototypeEvents.push((e as CustomEvent).detail),
    );
  });
});

test("guest → preview → dismiss registration → register → same answer → follow-up → reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let queries = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/demo-assistant") queries++;
  });
  await page.goto("/");
  await expect(
    widget(page).getByRole("button", { name: "Получить ответ" }),
  ).toBeDisabled();
  await screenshot(page, "desktop-initial");
  await screenshot(page, "desktop-page", true);
  await widget(page)
    .getByRole("button", { name: "Как включить сортировку по фамилии?" })
    .click();
  await expect(page.getByLabel("Ваш вопрос", { exact: true })).toHaveValue(
    "Как включить сортировку по фамилии?",
  );
  expect(queries).toBe(0);
  await widget(page).getByRole("button", { name: "Получить ответ" }).click();
  await expect(widget(page).getByRole("status")).toContainText(
    "Готовлю ответ по статье",
  );
  await expect(
    widget(page).getByRole("button", {
      name: "Зарегистрироваться и посмотреть ответ",
    }),
  ).toBeVisible();
  expect(queries).toBe(1);
  await expect(log(page)).not.toContainText("Нажмите «Записать и закрыть»");
  await widget(page).scrollIntoViewIfNeeded();
  await screenshot(page, "desktop-preview");
  await widget(page)
    .getByRole("button", { name: "Зарегистрироваться и посмотреть ответ" })
    .click();
  await screenshot(page, "registration");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(log(page)).toContainText("Как включить сортировку по фамилии?");
  await widget(page)
    .getByRole("button", { name: "Зарегистрироваться и посмотреть ответ" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect(log(page)).toContainText("Записать и закрыть");
  expect(queries).toBe(1);
  await expect(
    page.getByLabel("Уточните вашу ситуацию", { exact: true }),
  ).toBeFocused();
  await screenshot(page, "full-answer");
  await page
    .getByLabel("Уточните вашу ситуацию", { exact: true })
    .fill("Можно сортировать по подразделению?");
  await widget(page).getByRole("button", { name: "Отправить" }).click();
  await expect(log(page)).toContainText("По подразделению (Приоритет)");
  await screenshot(page, "follow-up");
  let events = await page.evaluate(() => window.prototypeEvents);
  expect(
    events.filter((e) => e.event === "h01_registration_success"),
  ).toHaveLength(1);
  expect(events.every((e) => e.initialGroup === "guest")).toBe(true);
  await widget(page).getByRole("button", { name: "Новый диалог" }).click();
  await expect(log(page)).toHaveCount(0);
  await expect(widget(page)).not.toContainText(
    "Полный ответ — после бесплатной регистрации",
  );
  await page
    .getByLabel("Ваш вопрос", { exact: true })
    .fill("А по табельному номеру?");
  await widget(page).getByRole("button", { name: "Получить ответ" }).click();
  await expect(log(page)).toContainText("в статье указана возможность");
  events = await page.evaluate(() => window.prototypeEvents);
  expect(
    events
      .filter((e) => e.event === "h01_question_submit")
      .map((e) => e.questionCount),
  ).toEqual([1, 2, 3]);
  const previousSession = events[0].sessionId;
  await page.reload();
  await expect(page.getByLabel("Ваш вопрос", { exact: true })).toHaveValue("");
  await expect(log(page)).toHaveCount(0);
  expect(
    (await page.evaluate(() => window.prototypeEvents))[0].sessionId,
  ).not.toBe(previousSession);
  expect(errors).toEqual([]);
});

test("existing login is not registration; form keyboard focus stays inside", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((e) => e.contains(document.activeElement)),
    ).toBe(true);
  }
  await screenshot(page, "login");
  await dialog.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(log(page)).toContainText("Записать и закрыть");
  const events = await page.evaluate(() => window.prototypeEvents);
  expect(events.filter((e) => e.event === "h01_existing_login")).toHaveLength(
    1,
  );
  expect(
    events.filter((e) => e.event === "h01_registration_success"),
  ).toHaveLength(0);
  expect(events.every((e) => e.initialGroup === "guest")).toBe(true);
});

test("API failure preserves draft and history; retry does not count twice", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Вошел заранее", exact: true })
    .click();
  await expect(widget(page)).not.toContainText(
    "Полный ответ — после бесплатной регистрации",
  );
  await page
    .getByLabel("Ваш вопрос", { exact: true })
    .fill("Как сортировать по фамилии?");
  await widget(page).getByRole("button", { name: "Получить ответ" }).click();
  await expect(log(page)).toContainText("Записать и закрыть");
  await page.route(
    "**/api/demo-assistant",
    (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Тестовая ошибка соединения. Вопрос сохранен.",
        }),
      }),
    { times: 1 },
  );
  await page
    .getByLabel("Уточните вашу ситуацию", { exact: true })
    .fill("А по табельному номеру?");
  await widget(page).getByRole("button", { name: "Отправить" }).click();
  await expect(widget(page).getByRole("alert")).toContainText(
    "Тестовая ошибка",
  );
  await expect(
    page.getByLabel("Уточните вашу ситуацию", { exact: true }),
  ).toHaveValue("А по табельному номеру?");
  await expect(log(page)).toContainText("Записать и закрыть");
  await screenshot(page, "error");
  await widget(page).getByRole("button", { name: "Повторить запрос" }).click();
  await expect(widget(page).getByRole("alert")).toHaveCount(0);
  await expect(log(page)).toContainText("в статье указана возможность");
  const events = await page.evaluate(() => window.prototypeEvents);
  expect(
    events
      .filter((e) => e.event === "h01_question_submit")
      .map((e) => e.questionCount),
  ).toEqual([1, 2]);
});

test("long conversation stays bounded and preserves reading position", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Длинный диалог", exact: true })
    .click();
  await expect(
    page.getByLabel("Уточните вашу ситуацию", { exact: true }),
  ).toBeEnabled();
  await expect(log(page).getByText("Ваш вопрос", { exact: true })).toHaveCount(
    6,
  );
  const height = await widget(page).evaluate(
    (e) => e.getBoundingClientRect().height,
  );
  expect(height).toBeLessThanOrEqual(700);
  await log(page).evaluate((e) => {
    e.scrollTop = 0;
    e.dispatchEvent(new Event("scroll"));
  });
  await widget(page).scrollIntoViewIfNeeded();
  await screenshot(page, "long-conversation");
  await page
    .getByLabel("Уточните вашу ситуацию", { exact: true })
    .fill("Не вижу этот пункт в своей версии");
  await widget(page).getByRole("button", { name: "Отправить" }).click();
  await expect(
    widget(page).getByRole("button", { name: "К новым сообщениям ↓" }),
  ).toBeVisible();
  expect(await log(page).evaluate((e) => e.scrollTop)).toBeLessThan(20);
  await widget(page)
    .getByRole("button", { name: "К новым сообщениям ↓" })
    .click();
  expect(
    await log(page).evaluate(
      (e) => e.scrollHeight - e.scrollTop - e.clientHeight,
    ),
  ).toBeLessThan(5);
});

test("closed answer is absent from payload; reveal requires auth and matching session", async ({
  request,
}) => {
  for (const path of [
    "/api/demo-assistant/auth",
    "/api/article-assistant/auth",
    "/api/demo-assistant/reveal",
    "/api/article-assistant/reveal",
  ]) {
    const invalid = await request.post(path, {
      data: "null",
      headers: { "Content-Type": "application/json" },
    });
    expect(invalid.status()).toBeGreaterThanOrEqual(400);
    expect(invalid.status()).toBeLessThan(500);
  }
  const sessionId = crypto.randomUUID();
  const response = await request.post("/api/demo-assistant", {
    data: {
      question: "Как сортировать по фамилии?",
      articleSlug: "sortirovka-sotrudnikov",
      history: [],
      sessionId,
      requestId: crypto.randomUUID(),
    },
  });
  expect(response.status()).toBe(200);
  const preview = await response.json();
  expect(preview.locked).toBe(true);
  expect(JSON.stringify(preview)).not.toContain("Записать и закрыть");
  expect(
    (
      await request.post("/api/demo-assistant/reveal", {
        data: { ticket: preview.ticket, sessionId },
      })
    ).status(),
  ).toBe(401);
  const { token } = await (
    await request.post("/api/demo-assistant/auth", { data: { kind: "login" } })
  ).json();
  expect(
    (
      await request.post("/api/demo-assistant/reveal", {
        data: { ticket: preview.ticket, sessionId: crypto.randomUUID(), token },
      })
    ).status(),
  ).toBe(400);
  const result = await (
    await request.post("/api/demo-assistant/reveal", {
      data: { ticket: preview.ticket, sessionId, token },
    })
  ).json();
  expect(result.text).toContain("Записать и закрыть");
});

test("Markdown renders formatting and rejects HTML and javascript URLs", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Вошел заранее", exact: true })
    .click();
  await expect(widget(page)).not.toContainText(
    "Полный ответ — после бесплатной регистрации",
  );
  await page.route("**/api/demo-assistant", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        locked: false,
        text: "## Заголовок\n\n**Важное**\n\n1. Первый шаг\n2. Второй шаг\n\n[Опасная ссылка](javascript:alert(1))\n\n<script>window.attacked=true</script>",
      }),
    }),
  );
  await page
    .getByLabel("Ваш вопрос", { exact: true })
    .fill("Проверьте форматирование");
  await widget(page).getByRole("button", { name: "Получить ответ" }).click();
  await expect(log(page).locator("strong")).toHaveText("Важное");
  await expect(log(page).locator("ol li")).toHaveCount(2);
  await expect(log(page).locator("script")).toHaveCount(0);
  expect(
    await log(page).getByText("Опасная ссылка").getAttribute("href"),
  ).not.toMatch(/^javascript:/);
});

test("widget view requires continuous 50% visibility for one second", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/demo");
  const seen = () =>
    page.evaluate(
      () =>
        window.prototypeEvents.filter(
          (e) => e.event === "article_ai_widget_view",
        ).length,
    );
  expect(await seen()).toBe(0);
  await widget(page).evaluate((e) =>
    window.scrollTo({
      top:
        e.getBoundingClientRect().top +
        scrollY -
        innerHeight +
        e.getBoundingClientRect().height * 0.49,
      behavior: "instant",
    }),
  );
  await page.waitForTimeout(1100);
  expect(await seen()).toBe(0);
  await widget(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  expect(await seen()).toBe(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(800);
  expect(await seen()).toBe(0);
  await widget(page).scrollIntoViewIfNeeded();
  await expect.poll(seen).toBe(1);
});

for (const width of [1440, 768, 390, 360])
  test(`responsive ${width}px — initial, registration, full answer`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    await page.goto("/");
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(await overflow()).toBe(false);
    await screenshot(page, `page-${width}`, true);
    await widget(page).scrollIntoViewIfNeeded();
    await screenshot(page, `initial-${width}`);
    expect(
      await page
        .getByLabel("Ваш вопрос", { exact: true })
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await page
      .getByLabel("Ваш вопрос", { exact: true })
      .fill(
        "Как включить сортировку по фамилии? " +
          "ОченьДлинноеСловоБезПробелов".repeat(14),
      );
    await widget(page).getByRole("button", { name: "Получить ответ" }).click();
    await widget(page)
      .getByRole("button", { name: "Зарегистрироваться и посмотреть ответ" })
      .click();
    await screenshot(page, `registration-${width}`);
    expect(
      await page
        .getByRole("dialog")
        .evaluate(
          (e) =>
            e.getBoundingClientRect().width <= innerWidth &&
            e.getBoundingClientRect().height <= innerHeight,
        ),
    ).toBe(true);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Зарегистрироваться", exact: true })
      .click();
    await expect(log(page)).toContainText("Записать и закрыть");
    await widget(page).scrollIntoViewIfNeeded();
    await screenshot(page, `full-${width}`);
    expect(await overflow()).toBe(false);
    expect(
      await widget(page).evaluate(
        (e) => e.getBoundingClientRect().height <= innerHeight * 0.7 + 1,
      ),
    ).toBe(true);
  });
