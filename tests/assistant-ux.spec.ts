import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });

test("glow waits for visibility, plays once and stays static after scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 300 });
  await page.goto("/");
  const card = page.locator("#assistant");
  const frame = card.locator("..");
  await expect(frame).toHaveAttribute("data-glow", "waiting");
  await card.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute("data-glow", "running");
  await expect(frame).toHaveAttribute("data-glow", "done", { timeout: 12000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await card.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute("data-glow", "done");
});

for (const trigger of ["focus", "submit"] as const) {
  test(`glow fades on ${trigger} and new dialog does not replay it`, async ({
    page,
  }) => {
    await page.goto("/");
    const card = page.locator("#assistant");
    const frame = card.locator("..");
    await card.scrollIntoViewIfNeeded();
    await expect(frame).toHaveAttribute("data-glow", "running");
    if (trigger === "focus") {
      await page.getByLabel("Ваш вопрос", { exact: true }).focus();
      await expect(frame).toHaveAttribute("data-glow", "settling");
      expect(
        await frame.evaluate(
          (e) => getComputedStyle(e, "::after").animationPlayState,
        ),
      ).toBe("paused");
    }
    await card
      .getByRole("button", {
        name: "Как включить сортировку по фамилии?",
        exact: true,
      })
      .click();
    await expect(frame).toHaveAttribute("data-glow", "done");
    await expect(
      card.getByRole("heading", { name: "Полный ответ уже готов" }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Новый диалог" }).click();
    await expect(frame).toHaveAttribute("data-glow", "done");
  });
}

test("reduced motion stays static, including when changed during the glow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const frame = page.locator("#assistant").locator("..");
  await expect(frame).toHaveAttribute("data-glow", "done");
  expect(
    await frame.evaluate((e) => getComputedStyle(e, "::after").animationName),
  ).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(frame).toHaveAttribute("data-glow", "done");
  await page.reload();
  await page.locator("#assistant").scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute("data-glow", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(frame).toHaveAttribute("data-glow", "done");
  expect(
    await frame.evaluate((e) => getComputedStyle(e, "::after").animationName),
  ).toBe("none");
});

for (const width of [1440, 390]) {
  test(`unified answer survives unlock at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/");
    const card = page.locator("#assistant");
    await card
      .getByRole("button", {
        name: "Как включить сортировку по фамилии?",
        exact: true,
      })
      .click();
    const heading = card.getByRole("heading", {
      name: "Полный ответ уже готов",
    });
    await expect(heading).toBeVisible();
    const gate = heading.locator("../..");
    const answer = gate.locator("..");
    const original = await answer.elementHandle();
    await expect(answer).toContainText("Сортировка по фамилии настраивается");
    const note = answer
      .locator("p")
      .filter({ hasText: "ИИ-помощник работает в тестовом режиме" });
    expect(
      await note.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(13);
    expect(
      await note.evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    await expect(note.locator("svg")).toHaveCount(1);
    await expect(heading.locator("svg rect")).toHaveCount(1);
    await gate
      .getByRole("button", { name: "Зарегистрироваться и посмотреть ответ" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Зарегистрироваться", exact: true })
      .click();
    await expect(card).toContainText("Записать и закрыть");
    expect(
      await original!.evaluate(
        (e) => e.isConnected && e.textContent!.includes("Записать и закрыть"),
      ),
    ).toBe(true);
    await expect(heading).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
