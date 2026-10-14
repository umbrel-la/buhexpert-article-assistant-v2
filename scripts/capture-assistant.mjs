import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Run against a production server: npm start -- --port 3002
// Override with CAPTURE_URL to capture an already deployed prototype.
const browser = await chromium.launch();
const destination = "docs/screenshots";
await mkdir(destination, { recursive: true });
try {
  for (const width of [2048, 1440, 1024, 390, 375]) {
    const page = await browser.newPage({
      viewport: { width, height: width > 700 ? 1100 : 844 },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    await page.goto(process.env.CAPTURE_URL || "http://localhost:3002");
    await page.evaluate(() => document.fonts.ready);
    const card = page.getByRole("region", {
      name: "ИИ-помощник по статье",
      exact: true,
    });
    const capture = async (state) => {
      await card.screenshot({
        path: `${destination}/ux-${width}-${state}.png`,
      });
      await card.evaluate((e) => {
        const box = e.getBoundingClientRect();
        window.scrollTo({
          top: box.top + scrollY - Math.max(24, (innerHeight - box.height) / 2),
          behavior: "instant",
        });
      });
      await page.screenshot({
        path: `${destination}/restored-${width}-${state}-page.png`,
      });
      if (state === "initial" || state === "long") {
        await page.screenshot({
          path: `${destination}/restored-${width}-${state}-full-page.png`,
          fullPage: true,
        });
      }
    };
    await capture("initial");
    if (width === 1440) {
      await page.screenshot({
        path: `${destination}/ux-desktop-page.png`,
        fullPage: true,
      });
    }
    if (width === 2048) {
      await card.evaluate((e) =>
        window.scrollTo({
          top: e.getBoundingClientRect().top + scrollY - 240,
          behavior: "instant",
        }),
      );
      await page.screenshot({ path: `${destination}/ux-wide-page.png` });
    }
    await card
      .getByRole("button", { name: "Как включить сортировку по фамилии?" })
      .click();
    const register = card.getByRole("button", {
      name: "Зарегистрироваться и посмотреть ответ",
    });
    await register.waitFor();
    await capture("preview");
    await register.click();
    const dialog = page.getByRole("dialog");
    await dialog.screenshot({
      path: `${destination}/ux-${width}-registration.png`,
    });
    await dialog
      .getByRole("button", { name: "Зарегистрироваться", exact: true })
      .click();
    const field = page.getByLabel("Уточните вашу ситуацию", { exact: true });
    await field.waitFor();
    await capture("dialog");
    await field.fill("Можно сортировать по подразделению?");
    await card.getByRole("button", { name: "Уточнить", exact: true }).click();
    await card
      .getByText("«По подразделению (Приоритет)»", { exact: true })
      .waitFor();
    const unread = card.getByRole("button", { name: "К новым сообщениям ↓" });
    if (await unread.isVisible()) await unread.click();
    await capture("follow-up");
    const history = page.getByRole("region", {
      name: "Переписка",
      exact: true,
    });
    for (const question of [
      "А по табельному номеру?",
      "Не вижу этот пункт в своей версии",
      "Как включить сортировку по фамилии?",
    ]) {
      const count = await history
        .getByText("Бухэксперт · ИИ-помощник", { exact: true })
        .count();
      await field.fill(question);
      await card.getByRole("button", { name: "Уточнить", exact: true }).click();
      await history
        .getByText("Бухэксперт · ИИ-помощник", { exact: true })
        .nth(count)
        .waitFor();
    }
    await history.evaluate((e) => {
      e.scrollTop = 0;
      e.dispatchEvent(new Event("scroll"));
    });
    await capture("long");
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Screenshots saved to ${destination}/ux-*.png`);
