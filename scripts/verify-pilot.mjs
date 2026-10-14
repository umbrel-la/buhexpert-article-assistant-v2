// Run after npm run build. All identity/model traffic stays on a local stub.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const calls = [];
const answers = [];
let sessionValid = true;
const upstream = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const data = JSON.parse(raw || "{}");
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/session") {
    assert.equal(request.headers.authorization, "Bearer local-identity-key");
    response.end(JSON.stringify(sessionValid && data.sessionId === "verified-test-session" ? { authenticated: true, userId: "test-user-42" } : { authenticated: false }));
  } else {
    assert.equal(request.headers.authorization, "Bearer local-model-key");
    calls.push(data.messages);
    const answer = `В 1С 8.3 откройте настройки. Проверьте п. 2 инструкции. Закрытое продолжение ответа ${calls.length}: сохраните результат и проверьте документ.`;
    answers.push(answer);
    response.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
  }
});
await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
const historyDir = await mkdtemp(join(tmpdir(), "assistant-pilot-test-"));
const port = process.env.PILOT_TEST_PORT || "3011";
const baseURL = `http://localhost:${port}`;
let child;
let output = "";
async function start() {
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port], {
    windowsHide: true,
    env: { ...process.env, VERCEL: "", ASSISTANT_MODE: "real", AUTH_MODE: "real", ASSISTANT_ENABLED: "true", ASSISTANT_PILOT_START: new Date().toISOString(), ASSISTANT_TOKEN_SECRET: "local-test-secret-not-for-production", AI_API_KEY: "local-model-key", AI_BASE_URL: upstreamUrl, AI_MODEL: "local-stub", BUHEXPERT_SESSION_COOKIE: "buhexpert_session", BUHEXPERT_SESSION_VERIFY_URL: `${upstreamUrl}/session`, BUHEXPERT_SESSION_VERIFY_KEY: "local-identity-key", ASSISTANT_HISTORY_DIR: historyDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", value => { output += value; });
  child.stderr.on("data", value => { output += value; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(output);
    try { if ((await fetch(`${baseURL}/api/auth/session`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${output}`);
}
async function stop() {
  if (child && child.exitCode === null) { const done = once(child, "exit"); child.kill(); await done; }
}
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
const records = async () => Promise.all((await readdir(historyDir)).filter(name => name.endsWith(".json")).map(async name => JSON.parse(await readFile(join(historyDir, name), "utf8"))));
try {
  await start();
  await page.goto("/");
  const widget = page.locator("#assistant");
  const requestPromise = page.waitForRequest(request => new URL(request.url()).pathname === "/api/article-assistant");
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/article-assistant");
  await widget.getByRole("button", { name: "Как включить сортировку по фамилии?", exact: true }).click();
  const sent = (await requestPromise).postDataJSON();
  const preview = await (await responsePromise).json();
  assert.equal(preview.text, "В 1С 8.3 откройте настройки. Проверьте п. 2 инструкции.");
  assert.equal(preview.locked, true);
  assert.ok(!JSON.stringify(preview).includes("Закрытое продолжение"));
  await expect(widget).not.toContainText("Закрытое продолжение");
  await expect(page.getByTestId("blurred-continuation")).toBeVisible();
  assert.deepEqual(calls[0].map(turn => turn.role), ["system", "user", "user"]);
  assert.ok(calls[0][0].content.includes("ИИ-помощник БухЭксперта"));
  assert.ok(calls[0][1].content.includes("По сотруднику (Имя)"));
  assert.equal((await records())[0].answer, answers[0]);
  const revealInput = { ticket: preview.ticket, sessionId: sent.sessionId };
  assert.equal((await page.request.post("/api/article-assistant/reveal", { data: revealInput })).status(), 401);
  const demoAuth = await (await page.request.post("/api/demo-assistant/auth", { data: { kind: "login" } })).json();
  assert.equal((await page.request.post("/api/article-assistant/reveal", { data: { ...revealInput, token: demoAuth.token } })).status(), 401);
  await context.addCookies([{ name: "buhexpert_session", value: "invalid-session", url: baseURL }]);
  assert.equal((await (await page.request.get("/api/auth/session")).json()).authenticated, false);
  await context.addCookies([{ name: "buhexpert_session", value: "verified-test-session", url: baseURL }]);
  assert.equal((await (await page.request.get("/api/auth/session")).json()).authenticated, true);
  const revealed = await (await page.request.post("/api/article-assistant/reveal", { data: revealInput })).json();
  assert.equal(revealed.text, answers[0]);
  assert.equal(calls.length, 1);
  assert.equal((await records())[0].userId, "test-user-42");
  await page.reload();
  await expect(page.getByRole("region", { name: "Переписка", exact: true })).toHaveCount(0);
  await widget.getByRole("button", { name: "Как включить сортировку по фамилии?", exact: true }).click();
  await expect(widget).toContainText("Закрытое продолжение ответа 2");
  await expect(page.getByTestId("blurred-continuation")).toHaveCount(0);
  await page.getByLabel("Уточните вашу ситуацию", { exact: true }).fill("Как проверить результат?");
  await widget.getByRole("button", { name: "Уточнить", exact: true }).click();
  await expect(widget).toContainText("Закрытое продолжение ответа 3");
  assert.deepEqual(calls[2].map(turn => turn.role), ["system", "user", "user", "assistant", "user"]);
  assert.ok(calls[2][3].content.includes(answers[1]));
  assert.ok(calls[2][4].content.includes("Как проверить результат?"));
  const otherArticle = await page.request.post("/api/article-assistant", { data: { ...sent, articleSlug: "os-v-1c-8-3", requestId: crypto.randomUUID(), history: [] } });
  assert.equal(otherArticle.status(), 200);
  assert.ok(calls[3][1].content.includes('slug="os-v-1c-8-3"'));
  assert.ok(!calls[3][1].content.includes("По сотруднику (Имя)"));
  sessionValid = false;
  await page.getByLabel("Уточните вашу ситуацию", { exact: true }).fill("Проверка истекшего входа");
  await widget.getByRole("button", { name: "Уточнить", exact: true }).click();
  await expect(widget.getByRole("button", { name: "Зарегистрироваться и посмотреть ответ" })).toBeVisible();
  await expect(widget.getByRole("button", { name: "Открыть сохраненный ответ" })).toHaveCount(0);
  sessionValid = true;
  const count = (await records()).length;
  await widget.getByRole("button", { name: "Новый диалог" }).click();
  await expect(page.getByLabel("Ваш вопрос", { exact: true })).toHaveValue("");
  assert.equal((await records()).length, count);
  await stop();
  await start();
  assert.equal((await records()).length, count);
  const retry = await (await page.request.post("/api/article-assistant", { data: sent })).json();
  assert.equal(retry.text, answers[0]);
  assert.equal(calls.length, 5);
  const restored = await (await page.request.post("/api/article-assistant/reveal", { data: revealInput })).json();
  assert.equal(restored.text, answers[0]);
  console.log("PASS: real adapter selection, session verification, demo-token rejection, private preview, same-answer reveal, full model history, two article contexts, durable records, user binding, reset and server restart. Model and identity providers were local stubs.");
} finally {
  await browser.close();
  await stop();
  upstream.close();
}
